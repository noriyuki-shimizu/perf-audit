import chokidar from 'chokidar';
import ora from 'ora';
import path from 'path';
import { BundleAnalyzer } from '../core/bundle-analyzer.js';
import { PerformanceDatabase } from '../core/database.js';
import { NotificationService } from '../core/notification-service.js';
import { AuditResult } from '../types/config.js';
import { loadConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { ConsoleReporter } from '../utils/reporter.js';
import { formatSize } from '../utils/size.js';

interface WatchOptions {
  interval?: number;
  threshold?: number;
  notify?: boolean;
  silent?: boolean;
}

export async function watchCommand(options: WatchOptions = {}): Promise<void> {
  Logger.section('Starting watch mode...');

  try {
    const config = await loadConfig();
    const analyzer = new BundleAnalyzer({
      outputPath: config.project.outputPath,
      gzip: config.analysis.gzip,
      ignorePaths: config.analysis.ignorePaths,
    });

    const db = new PerformanceDatabase();
    const reporter = new ConsoleReporter(config);
    const notificationService = options.notify ? new NotificationService(config) : null;

    let isAnalyzing = false;
    let lastAnalysisTime = 0;
    const threshold = options.threshold || 5; // Size change threshold in KB
    const interval = options.interval || 1000; // Debounce interval in ms

    // Store baseline
    let baseline: AuditResult | null = null;

    // Initial analysis
    Logger.info('Running initial analysis...');
    try {
      baseline = await performAnalysis(analyzer, config, db, reporter, options.silent);
      Logger.success('Initial analysis completed');
    } catch {
      Logger.warn('Initial analysis failed, will retry on changes');
    }

    // Setup file watcher
    const watchPaths = [
      config.project.outputPath,
      config.project.configPath || 'webpack.config.js',
    ].filter(Boolean);

    Logger.debug(`Watching paths: ${watchPaths.join(', ')}`);

    const watcher = chokidar.watch(watchPaths, {
      ignored: /node_modules/,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    watcher.on('change', async (filePath: string) => {
      const now = Date.now();

      // Debounce rapid changes
      if (now - lastAnalysisTime < interval || isAnalyzing) {
        return;
      }

      lastAnalysisTime = now;
      isAnalyzing = true;

      if (!options.silent) {
        Logger.info(`File changed: ${path.relative(process.cwd(), filePath)}`);
      }

      try {
        const currentResult = await performAnalysis(analyzer, config, db, reporter, options.silent);

        // Compare with baseline
        if (baseline && currentResult) {
          const changes = compareResults(baseline, currentResult);

          if (changes.significantChanges.length > 0) {
            displayChanges(changes);

            // Send notifications if enabled
            if (notificationService) {
              await notificationService.sendPerformanceAlert({
                type: changes.hasRegression ? 'regression' : 'improvement',
                changes: changes.significantChanges,
                result: currentResult,
              });
            }
          }

          // Update baseline
          baseline = currentResult;
        } else {
          baseline = currentResult;
        }
      } catch (error) {
        if (!options.silent) {
          Logger.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        isAnalyzing = false;
      }
    });

    watcher.on('error', error => {
      Logger.error(`Watch error: ${error}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      Logger.info('Stopping watch mode...');
      watcher.close();
      db.close();
      process.exit(0);
    });

    Logger.success('Watch mode active. Press Ctrl+C to stop.');
    Logger.info('Waiting for changes...');
  } catch (error) {
    Logger.error(`Failed to start watch mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

async function performAnalysis(
  analyzer: BundleAnalyzer,
  config: any,
  db: PerformanceDatabase,
  reporter: ConsoleReporter,
  silent = false,
): Promise<AuditResult> {
  const spinner = silent ? null : ora('Analyzing...').start();

  try {
    const bundles = await analyzer.analyzeBundles();

    if (bundles.length === 0) {
      throw new Error('No bundles found for analysis');
    }

    const bundlesWithBudgets = BundleAnalyzer.applyBudgets(bundles, config.budgets.bundles);

    const result: AuditResult = {
      timestamp: new Date().toISOString(),
      bundles: bundlesWithBudgets,
      recommendations: [],
      budgetStatus: getBudgetStatus(bundlesWithBudgets),
    };

    // Save to database
    db.saveBuild({
      timestamp: result.timestamp,
      bundles: result.bundles,
      recommendations: result.recommendations,
    });

    if (spinner) {
      spinner.succeed('Analysis completed');
    } else if (!silent) {
      Logger.success('Analysis completed');
    }

    return result;
  } catch (error) {
    if (spinner) {
      spinner.fail('Analysis failed');
    }
    throw error;
  }
}

interface PerformanceComparison {
  significantChanges: BundleChange[];
  hasRegression: boolean;
  hasImprovement: boolean;
  totalSizeChange: number;
}

interface BundleChange {
  name: string;
  previousSize: number;
  currentSize: number;
  delta: number;
  percentage: number;
  isRegression: boolean;
}

function compareResults(baseline: AuditResult, current: AuditResult): PerformanceComparison {
  const changes: BundleChange[] = [];
  let hasRegression = false;
  let hasImprovement = false;

  // Create maps for easier lookup
  const baselineMap = new Map(baseline.bundles.map(b => [b.name, b]));
  const currentMap = new Map(current.bundles.map(b => [b.name, b]));

  // Compare existing bundles
  for (const [name, currentBundle] of currentMap) {
    const baselineBundle = baselineMap.get(name);

    if (baselineBundle) {
      const delta = currentBundle.size - baselineBundle.size;
      const percentage = (delta / baselineBundle.size) * 100;

      // Only consider significant changes (> 1KB or > 5%)
      if (Math.abs(delta) > 1024 || Math.abs(percentage) > 5) {
        const isRegression = delta > 0;

        changes.push({
          name,
          previousSize: baselineBundle.size,
          currentSize: currentBundle.size,
          delta,
          percentage,
          isRegression,
        });

        if (isRegression) {
          hasRegression = true;
        } else {
          hasImprovement = true;
        }
      }
    } else {
      // New bundle
      changes.push({
        name,
        previousSize: 0,
        currentSize: currentBundle.size,
        delta: currentBundle.size,
        percentage: 100,
        isRegression: true,
      });
      hasRegression = true;
    }
  }

  // Check for removed bundles
  for (const [name, baselineBundle] of baselineMap) {
    if (!currentMap.has(name)) {
      changes.push({
        name,
        previousSize: baselineBundle.size,
        currentSize: 0,
        delta: -baselineBundle.size,
        percentage: -100,
        isRegression: false,
      });
      hasImprovement = true;
    }
  }

  const totalSizeChange = changes.reduce((sum, change) => sum + change.delta, 0);

  return {
    significantChanges: changes,
    hasRegression,
    hasImprovement,
    totalSizeChange,
  };
}

function displayChanges(comparison: PerformanceComparison): void {
  const { significantChanges, totalSizeChange } = comparison;

  Logger.section('Performance Changes Detected');

  // Total change summary
  const totalChangeIcon = totalSizeChange > 0 ? '📈' : '📉';
  const totalSizeText = `Total size change: ${formatSize(Math.abs(totalSizeChange))}`;
  if (totalSizeChange > 0) {
    Logger.warn(`${totalChangeIcon} ${totalSizeText}`);
  } else {
    Logger.success(`${totalChangeIcon} ${totalSizeText}`);
  }

  // Individual bundle changes
  Logger.info('Bundle Changes:');
  significantChanges.forEach(change => {
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

    if (change.currentSize === 0) {
      Logger.debug('   Bundle was removed');
    } else if (change.previousSize === 0) {
      Logger.debug('   New bundle added');
    } else {
      Logger.debug(`   ${formatSize(change.previousSize)} → ${formatSize(change.currentSize)}`);
    }
  });
}

function getBudgetStatus(bundles: any[]): 'ok' | 'warning' | 'error' {
  const hasError = bundles.some(b => b.status === 'error');
  const hasWarning = bundles.some(b => b.status === 'warning');

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'ok';
}
