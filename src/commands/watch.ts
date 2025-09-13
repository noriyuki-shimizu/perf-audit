import chokidar, { FSWatcher } from 'chokidar';
import ora from 'ora';
import path from 'path';
import {
  DEFAULT_DEBOUNCE_INTERVAL,
  MIN_PERCENTAGE_CHANGE_THRESHOLD,
  MIN_SIZE_CHANGE_THRESHOLD,
  WATCHER_POLL_INTERVAL,
  WATCHER_STABILITY_THRESHOLD,
} from '../constants/index.ts';
import { BundleAnalyzer } from '../core/bundle-analyzer.ts';
import { PerformanceDatabaseService } from '../core/database/index.ts';
import { NotificationService } from '../core/notification-service.ts';
import type { BundleChange, PerformanceComparison, WatchOptions, WatchState } from '../types/commands.ts';
import type { AuditResult, BundleInfo, PerfAuditConfig } from '../types/config.ts';
import { applyBudgetsToAllBundles, createAuditResult } from '../utils/bundle.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';
import { formatSize } from '../utils/size.ts';

/**
 * Execute watch command to monitor bundle changes in real-time
 * @param options - Watch command options
 */
export const watchCommand = async (options: WatchOptions = {}): Promise<void> => {
  Logger.section('Starting watch mode...');

  try {
    const config = await loadConfig();
    const db = await PerformanceDatabaseService.instance();
    const notificationService = createNotificationService(config, options.notify);

    const watchState = initializeWatchState();
    const interval = options.interval || DEFAULT_DEBOUNCE_INTERVAL;

    await performInitialAnalysis(config, db, options.silent, watchState);
    await setupFileWatcher(config, db, notificationService, options, watchState, interval);

    setupGracefulShutdown(db);
    logWatchModeActive();
  } catch (error) {
    handleWatchError(error);
  }
};

/**
 * Create notification service if notifications are enabled
 * @param config - Application configuration
 * @param notify - Whether notifications are enabled
 * @returns Notification service instance or null
 */
const createNotificationService = (config: PerfAuditConfig, notify?: boolean): NotificationService | null => {
  return notify ? new NotificationService(config) : null;
};

/**
 * Initialize watch state
 * @returns Initial watch state
 */
const initializeWatchState = (): WatchState => ({
  isAnalyzing: false,
  lastAnalysisTime: 0,
  baseline: null,
});

/**
 * Perform initial analysis to establish baseline
 * @param config - Application configuration
 * @param db - Performance database instance
 * @param silent - Whether to suppress output
 * @param watchState - Watch state object
 */
const performInitialAnalysis = async (
  config: PerfAuditConfig,
  db: PerformanceDatabaseService,
  silent: boolean = false,
  watchState: WatchState,
): Promise<void> => {
  Logger.info('Running initial analysis...');
  try {
    watchState.baseline = await performAnalysis(config, db, silent);
    Logger.success('Initial analysis completed');
  } catch {
    Logger.warn('Initial analysis failed, will retry on changes');
  }
};

/**
 * Setup file watcher for bundle changes
 * @param config - Application configuration
 * @param db - Performance database instance
 * @param notificationService - Notification service instance
 * @param options - Watch options
 * @param watchState - Watch state object
 * @param interval - Debounce interval
 */
const setupFileWatcher = async (
  config: PerfAuditConfig,
  db: PerformanceDatabaseService,
  notificationService: NotificationService | null,
  options: WatchOptions,
  watchState: WatchState,
  interval: number,
): Promise<void> => {
  const watchPaths = getWatchPaths(config);
  Logger.debug(`Watching paths: ${watchPaths.join(', ')}`);

  const watcher = createFileWatcher(watchPaths);

  watcher.on('change', async (filePath: string) => {
    await handleFileChange(filePath, config, db, notificationService, options, watchState, interval);
  });

  watcher.on('error', handleWatcherError);
};

/**
 * Get paths to watch for file changes
 * @param config - Application configuration
 * @returns Array of paths to watch
 */
const getWatchPaths = (config: PerfAuditConfig): string[] => {
  return [
    config.project.client.outputPath,
    config.project.server.outputPath,
  ].filter(Boolean);
};

/**
 * Create file watcher instance
 * @param watchPaths - Paths to watch
 * @returns Chokidar watcher instance
 */
const createFileWatcher = (watchPaths: string[]): FSWatcher => {
  return chokidar.watch(watchPaths, {
    ignored: /node_modules/,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: WATCHER_STABILITY_THRESHOLD,
      pollInterval: WATCHER_POLL_INTERVAL,
    },
  });
};

/**
 * Handle file change event
 * @param filePath - Path of changed file
 * @param config - Application configuration
 * @param db - Performance database instance
 * @param notificationService - Notification service instance
 * @param options - Watch options
 * @param watchState - Watch state object
 * @param interval - Debounce interval
 */
const handleFileChange = async (
  filePath: string,
  config: PerfAuditConfig,
  db: PerformanceDatabaseService,
  notificationService: NotificationService | null,
  options: WatchOptions,
  watchState: WatchState,
  interval: number,
): Promise<void> => {
  const now = Date.now();

  if (shouldSkipAnalysis(now, watchState, interval)) {
    return;
  }

  updateWatchState(watchState, now);
  logFileChange(filePath, options.silent);

  try {
    const currentResult = await performAnalysis(config, db, options.silent);
    await processAnalysisResult(currentResult, watchState, notificationService);
  } catch (error) {
    handleAnalysisError(error, options.silent);
  } finally {
    watchState.isAnalyzing = false;
  }
};

/**
 * Check if analysis should be skipped due to debouncing
 * @param now - Current timestamp
 * @param watchState - Watch state object
 * @param interval - Debounce interval
 * @returns Whether to skip analysis
 */
const shouldSkipAnalysis = (now: number, watchState: WatchState, interval: number): boolean => {
  return now - watchState.lastAnalysisTime < interval || watchState.isAnalyzing;
};

/**
 * Update watch state for new analysis
 * @param watchState - Watch state object
 * @param timestamp - Current timestamp
 */
const updateWatchState = (watchState: WatchState, timestamp: number): void => {
  watchState.lastAnalysisTime = timestamp;
  watchState.isAnalyzing = true;
};

/**
 * Log file change event
 * @param filePath - Path of changed file
 * @param silent - Whether to suppress output
 */
const logFileChange = (filePath: string, silent: boolean = false): void => {
  if (!silent) {
    Logger.info(`File changed: ${path.relative(process.cwd(), filePath)}`);
  }
};

/**
 * Process analysis result and compare with baseline
 * @param currentResult - Current analysis result
 * @param watchState - Watch state object
 * @param notificationService - Notification service instance
 */
const processAnalysisResult = async (
  currentResult: AuditResult,
  watchState: WatchState,
  notificationService: NotificationService | null,
): Promise<void> => {
  if (watchState.baseline && currentResult) {
    const changes = compareResults(watchState.baseline, currentResult);

    if (changes.significantChanges.length > 0) {
      displayChanges(changes);
      await sendNotifications(notificationService, changes, currentResult);
    }

    watchState.baseline = currentResult;
  } else {
    watchState.baseline = currentResult;
  }
};

/**
 * Send notifications for performance changes
 * @param notificationService - Notification service instance
 * @param changes - Performance comparison result
 * @param result - Current audit result
 */
const sendNotifications = async (
  notificationService: NotificationService | null,
  changes: PerformanceComparison,
  result: AuditResult,
): Promise<void> => {
  if (notificationService) {
    await notificationService.sendPerformanceAlert({
      type: changes.hasRegression ? 'regression' : 'improvement',
      changes: changes.significantChanges,
      result,
    });
  }
};

/**
 * Handle analysis errors
 * @param error - Error object
 * @param silent - Whether to suppress output
 */
const handleAnalysisError = (error: unknown, silent: boolean = false): void => {
  if (!silent) {
    Logger.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Handle file watcher errors
 * @param error - Error object
 */
const handleWatcherError = (error: unknown): void => {
  Logger.error(`Watch error: ${error}`);
};

/**
 * Setup graceful shutdown handlers
 * @param db - Performance database instance
 */
const setupGracefulShutdown = (db: PerformanceDatabaseService): void => {
  process.on('SIGINT', async () => {
    Logger.info('Stopping watch mode...');
    await db.close();
    process.exit(0);
  });
};

/**
 * Log that watch mode is active
 */
const logWatchModeActive = (): void => {
  Logger.success('Watch mode active. Press Ctrl+C to stop.');
  Logger.info('Waiting for changes...');
};

/**
 * Handle watch command errors
 * @param error - Error object
 */
const handleWatchError = (error: unknown): void => {
  Logger.error(`Failed to start watch mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exit(1);
};

/**
 * Perform bundle analysis and return audit result
 * @param config - Application configuration
 * @param db - Performance database instance
 * @param silent - Whether to suppress output
 * @returns Audit result
 */
const performAnalysis = async (
  config: PerfAuditConfig,
  db: PerformanceDatabaseService,
  silent: boolean = false,
): Promise<AuditResult> => {
  const spinner = createAnalysisSpinner(silent);

  try {
    const bundles = await analyzeBundles(config);
    const bundlesWithBudgets = applyBudgetsToAllBundles(bundles, config);
    const result = createAuditResult(bundlesWithBudgets, config);

    saveBuildToDatabase(db, result);
    succeedAnalysisSpinner(spinner, silent);

    return result;
  } catch (error) {
    failAnalysisSpinner(spinner);
    throw error;
  }
};

/**
 * Create spinner for analysis if not in silent mode
 * @param silent - Whether to suppress output
 * @returns Spinner instance or null
 */
const createAnalysisSpinner = (silent: boolean): unknown => {
  return silent ? null : ora('Analyzing...').start();
};

/**
 * Analyze bundles for both client and server
 * @param config - Application configuration
 * @returns Array of analyzed bundles
 */
const analyzeBundles = async (config: PerfAuditConfig): Promise<BundleInfo[]> => {
  const allBundles: BundleInfo[] = [];
  const analysisTarget = config.analysis.target;

  if (analysisTarget === 'client' || analysisTarget === 'both') {
    const clientBundles = await analyzeClientBundles(config);
    allBundles.push(...clientBundles);
  }

  if (analysisTarget === 'server' || analysisTarget === 'both') {
    const serverBundles = await analyzeServerBundles(config);
    allBundles.push(...serverBundles);
  }

  if (allBundles.length === 0) {
    throw new Error('No bundles found for analysis');
  }

  return allBundles;
};

/**
 * Analyze client-side bundles
 * @param config - Application configuration
 * @returns Array of client bundles with type annotation
 */
const analyzeClientBundles = async (config: PerfAuditConfig): Promise<BundleInfo[]> => {
  const clientAnalyzer = new BundleAnalyzer({
    outputPath: config.project.client.outputPath,
    gzip: config.analysis.gzip,
    ignorePaths: config.analysis.ignorePaths,
  });

  const clientBundles = await clientAnalyzer.analyzeBundles();
  return clientBundles.map(bundle => ({ ...bundle, type: 'client' as const }));
};

/**
 * Analyze server-side bundles
 * @param config - Application configuration
 * @returns Array of server bundles with type annotation
 */
const analyzeServerBundles = async (config: PerfAuditConfig): Promise<BundleInfo[]> => {
  const serverAnalyzer = new BundleAnalyzer({
    outputPath: config.project.server.outputPath,
    gzip: config.analysis.gzip,
    ignorePaths: config.analysis.ignorePaths,
  });

  const serverBundles = await serverAnalyzer.analyzeBundles();
  return serverBundles.map(bundle => ({ ...bundle, type: 'server' as const }));
};

/**
 * Save build data to database
 * @param db - Performance database instance
 * @param result - Audit result
 */
const saveBuildToDatabase = async (db: PerformanceDatabaseService, result: AuditResult): Promise<void> => {
  await db.saveBuild({
    timestamp: result.timestamp,
    bundles: result.bundles,
    recommendations: result.recommendations,
  });
};

/**
 * Mark analysis spinner as successful
 * @param spinner - Spinner instance
 * @param silent - Whether to suppress output
 */
const succeedAnalysisSpinner = (spinner: unknown, silent: boolean): void => {
  if (spinner) {
    (spinner as { succeed: (text: string) => void; }).succeed('Analysis completed');
  } else if (!silent) {
    Logger.success('Analysis completed');
  }
};

/**
 * Mark analysis spinner as failed
 * @param spinner - Spinner instance
 */
const failAnalysisSpinner = (spinner: unknown): void => {
  if (spinner) {
    (spinner as { fail: (text: string) => void; }).fail('Analysis failed');
  }
};

/**
 * Compare baseline and current analysis results
 * @param baseline - Baseline audit result
 * @param current - Current audit result
 * @returns Performance comparison result
 */
const compareResults = (baseline: AuditResult, current: AuditResult): PerformanceComparison => {
  const changes: BundleChange[] = [];
  let hasRegression = false;
  let hasImprovement = false;

  const baselineMap = new Map(baseline.bundles.map(b => [b.name, b]));
  const currentMap = new Map(current.bundles.map(b => [b.name, b]));

  // Compare existing bundles
  for (const [name, currentBundle] of currentMap) {
    const baselineBundle = baselineMap.get(name);

    if (baselineBundle) {
      const change = calculateBundleChange(name, baselineBundle, currentBundle);
      if (isSignificantChange(change)) {
        changes.push(change);
        if (change.isRegression) {
          hasRegression = true;
        } else {
          hasImprovement = true;
        }
      }
    } else {
      // New bundle
      const change = createNewBundleChange(name, currentBundle);
      changes.push(change);
      hasRegression = true;
    }
  }

  // Check for removed bundles
  const removedChanges = findRemovedBundles(baselineMap, currentMap);
  changes.push(...removedChanges);
  if (removedChanges.length > 0) {
    hasImprovement = true;
  }

  const totalSizeChange = calculateTotalSizeChange(changes);

  return {
    significantChanges: changes,
    hasRegression,
    hasImprovement,
    totalSizeChange,
  };
};

/**
 * Calculate bundle change between baseline and current
 * @param name - Bundle name
 * @param baselineBundle - Baseline bundle info
 * @param currentBundle - Current bundle info
 * @returns Bundle change object
 */
const calculateBundleChange = (name: string, baselineBundle: BundleInfo, currentBundle: BundleInfo): BundleChange => {
  const delta = currentBundle.size - baselineBundle.size;
  const percentage = (delta / baselineBundle.size) * 100;

  return {
    name,
    previousSize: baselineBundle.size,
    currentSize: currentBundle.size,
    delta,
    percentage,
    isRegression: delta > 0,
  };
};

/**
 * Check if bundle change is significant
 * @param change - Bundle change object
 * @returns Whether the change is significant
 */
const isSignificantChange = (change: BundleChange): boolean => {
  return Math.abs(change.delta) > MIN_SIZE_CHANGE_THRESHOLD
    || Math.abs(change.percentage) > MIN_PERCENTAGE_CHANGE_THRESHOLD;
};

/**
 * Create bundle change for new bundle
 * @param name - Bundle name
 * @param currentBundle - Current bundle info
 * @returns Bundle change object for new bundle
 */
const createNewBundleChange = (name: string, currentBundle: BundleInfo): BundleChange => ({
  name,
  previousSize: 0,
  currentSize: currentBundle.size,
  delta: currentBundle.size,
  percentage: 100,
  isRegression: true,
});

/**
 * Find removed bundles between baseline and current
 * @param baselineMap - Map of baseline bundles
 * @param currentMap - Map of current bundles
 * @returns Array of bundle changes for removed bundles
 */
const findRemovedBundles = (
  baselineMap: Map<string, BundleInfo>,
  currentMap: Map<string, BundleInfo>,
): BundleChange[] => {
  const removedChanges: BundleChange[] = [];

  for (const [name, baselineBundle] of baselineMap) {
    if (!currentMap.has(name)) {
      removedChanges.push({
        name,
        previousSize: baselineBundle.size,
        currentSize: 0,
        delta: -baselineBundle.size,
        percentage: -100,
        isRegression: false,
      });
    }
  }

  return removedChanges;
};

/**
 * Calculate total size change across all bundle changes
 * @param changes - Array of bundle changes
 * @returns Total size change in bytes
 */
const calculateTotalSizeChange = (changes: BundleChange[]): number => {
  return changes.reduce((sum, change) => sum + change.delta, 0);
};

/**
 * Display performance changes in console
 * @param comparison - Performance comparison result
 */
const displayChanges = (comparison: PerformanceComparison): void => {
  const { significantChanges, totalSizeChange } = comparison;

  Logger.section('Performance Changes Detected');

  displayTotalSizeChange(totalSizeChange);
  displayIndividualChanges(significantChanges);
};

/**
 * Display total size change summary
 * @param totalSizeChange - Total size change in bytes
 */
const displayTotalSizeChange = (totalSizeChange: number): void => {
  const totalChangeIcon = totalSizeChange > 0 ? '📈' : '📉';
  const totalSizeText = `Total size change: ${formatSize(Math.abs(totalSizeChange))}`;

  if (totalSizeChange > 0) {
    Logger.warn(`${totalChangeIcon} ${totalSizeText}`);
  } else {
    Logger.success(`${totalChangeIcon} ${totalSizeText}`);
  }
};

/**
 * Display individual bundle changes
 * @param changes - Array of bundle changes
 */
const displayIndividualChanges = (changes: BundleChange[]): void => {
  Logger.info('Bundle Changes:');
  changes.forEach(change => {
    const icon = change.isRegression ? '🔺' : '🔻';
    const deltaText = change.delta > 0 ? `+${formatSize(change.delta)}` : formatSize(change.delta);
    const percentageText = change.percentage > 0
      ? `+${change.percentage.toFixed(1)}%`
      : `${change.percentage.toFixed(1)}%`;

    const message = `${icon} ${change.name}: ${deltaText} (${percentageText})`;
    if (change.isRegression) {
      Logger.warn(message);
    } else {
      Logger.success(message);
    }

    displayChangeDetails(change);
  });
};

/**
 * Display detailed information about bundle change
 * @param change - Bundle change object
 */
const displayChangeDetails = (change: BundleChange): void => {
  if (change.currentSize === 0) {
    Logger.debug('   Bundle was removed');
  } else if (change.previousSize === 0) {
    Logger.debug('   New bundle added');
  } else {
    Logger.debug(`   ${formatSize(change.previousSize)} → ${formatSize(change.currentSize)}`);
  }
};
