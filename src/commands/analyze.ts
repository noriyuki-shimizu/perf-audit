import ora from 'ora';
import path from 'path';
import { BundleAnalyzer } from '../core/bundle-analyzer.ts';
import { PerformanceDatabase } from '../core/database.ts';
import { PluginManager } from '../core/plugin-system.ts';
import type { 
  AnalyzeOptions,
  AnalysisContext,
  BundleAnalysisContext,
  AfterBundleAnalysisContext,
  AfterAnalysisContext,
  BeforeReportContext,
  AfterReportContext,
  ErrorContext
} from '../types/commands.ts';
import type { AuditResult, BundleInfo } from '../types/config.ts';
import { CIIntegration } from '../utils/ci-integration.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';
import { ReportGenerator } from '../utils/report-generator.ts';
import { ConsoleReporter } from '../utils/reporter.ts';

/** Large client bundle size threshold in bytes */
const LARGE_CLIENT_BUNDLE_THRESHOLD = 150 * 1024;

/** Small chunk size threshold in bytes */
const SMALL_CHUNK_THRESHOLD = 10 * 1024;

/** Large server bundle size threshold in bytes */
const LARGE_SERVER_BUNDLE_THRESHOLD = 200 * 1024;

/** Heavy server bundle size threshold in bytes */
const HEAVY_SERVER_BUNDLE_THRESHOLD = 100 * 1024;

/** Minimum number of small chunks to trigger merge recommendation */
const MIN_SMALL_CHUNKS_FOR_RECOMMENDATION = 3;

/** Plugin manager context for analysis */


/**
 * Execute bundle analysis command
 * @param options - Analysis options
 */
export const analyzeCommand = async (options: AnalyzeOptions): Promise<void> => {
  const spinner = ora('Loading configuration...').start();

  try {
    const config = await loadConfig();
    const pluginManager = new PluginManager(config);

    await initializePlugins(pluginManager, config);

    spinner.text = 'Analyzing bundles...';

    const bundles = await analyzeBundles(config, pluginManager);

    if (bundles.length === 0) {
      handleNoBundlesFound(spinner);
      return;
    }

    const bundlesWithBudgets = applyBudgetsToAllBundles(bundles, config);
    const result = createAuditResult(bundlesWithBudgets, config);

    await saveBuildToDatabase(result);
    await pluginManager.executeHook('afterAnalysis', { result } as AfterAnalysisContext);

    spinner.succeed('Bundle analysis completed');

    await generateReports(result, options, config, pluginManager);
    await outputCIResults(result);
    await pluginManager.unloadPlugins();
  } catch (error) {
    await handleAnalysisError(spinner, error);
  }
};

/**
 * Initialize plugin system
 * @param pluginManager - Plugin manager instance
 * @param config - Configuration object
 */
const initializePlugins = async (pluginManager: PluginManager, config: unknown): Promise<void> => {
  await pluginManager.loadPlugins();
  await pluginManager.executeHook('beforeAnalysis', { config } as AnalysisContext);
};

/**
 * Analyze bundles for both client and server
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 * @returns Array of analyzed bundles
 */
const analyzeBundles = async (config: any, pluginManager: PluginManager): Promise<BundleInfo[]> => {
  const allBundles: BundleInfo[] = [];
  const analysisTarget = config.analysis.target;

  if (analysisTarget === 'client' || analysisTarget === 'both') {
    const clientBundles = await analyzeClientBundles(config, pluginManager);
    allBundles.push(...clientBundles);
  }

  if (analysisTarget === 'server' || analysisTarget === 'both') {
    const serverBundles = await analyzeServerBundles(config, pluginManager);
    allBundles.push(...serverBundles);
  }

  await pluginManager.executeHook('afterBundleAnalysis', { bundles: allBundles } as AfterBundleAnalysisContext);

  return allBundles;
};

/**
 * Analyze client-side bundles
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 * @returns Array of client bundles with type annotation
 */
const analyzeClientBundles = async (config: any, pluginManager: PluginManager): Promise<BundleInfo[]> => {
  const clientAnalyzer = new BundleAnalyzer({
    outputPath: config.project.client.outputPath,
    gzip: config.analysis.gzip,
    ignorePaths: config.analysis.ignorePaths,
  });

  await pluginManager.executeHook('beforeBundleAnalysis', {
    outputPath: config.project.client.outputPath,
  } as BundleAnalysisContext);

  const clientBundles = await clientAnalyzer.analyzeBundles();
  return clientBundles.map(bundle => ({ ...bundle, type: 'client' as const }));
};

/**
 * Analyze server-side bundles
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 * @returns Array of server bundles with type annotation
 */
const analyzeServerBundles = async (config: any, pluginManager: PluginManager): Promise<BundleInfo[]> => {
  const serverAnalyzer = new BundleAnalyzer({
    outputPath: config.project.server.outputPath,
    gzip: config.analysis.gzip,
    ignorePaths: config.analysis.ignorePaths,
  });

  await pluginManager.executeHook('beforeBundleAnalysis', {
    outputPath: config.project.server.outputPath,
  } as BundleAnalysisContext);

  const serverBundles = await serverAnalyzer.analyzeBundles();
  return serverBundles.map(bundle => ({ ...bundle, type: 'server' as const }));
};

/**
 * Handle case when no bundles are found
 * @param spinner - Ora spinner instance
 */
const handleNoBundlesFound = (spinner: any): void => {
  spinner.fail('No bundles found for analysis');
  Logger.warn('Make sure your project has been built and the output path is correct.');
};

/**
 * Apply budgets to all bundles (client and server)
 * @param bundles - Array of bundles
 * @param config - Configuration object
 * @returns Array of bundles with budget status applied
 */
const applyBudgetsToAllBundles = (bundles: BundleInfo[], config: any): BundleInfo[] => {
  const clientBundles = bundles.filter(b => b.type === 'client');
  const serverBundles = bundles.filter(b => b.type === 'server');
  const bundlesWithBudgets: BundleInfo[] = [];

  if (clientBundles.length > 0) {
    const clientBundlesWithBudgets = BundleAnalyzer.applyBudgets(clientBundles, config.budgets.client.bundles);
    bundlesWithBudgets.push(...clientBundlesWithBudgets);
  }

  if (serverBundles.length > 0) {
    const serverBundlesWithBudgets = BundleAnalyzer.applyBudgets(serverBundles, config.budgets.server.bundles);
    bundlesWithBudgets.push(...serverBundlesWithBudgets);
  }

  return bundlesWithBudgets;
};

/**
 * Create audit result object
 * @param bundlesWithBudgets - Bundles with budget status applied
 * @param config - Configuration object
 * @returns Audit result object
 */
const createAuditResult = (bundlesWithBudgets: BundleInfo[], config: any): AuditResult => {
  return {
    timestamp: new Date().toISOString(),
    bundles: bundlesWithBudgets,
    recommendations: generateRecommendations(bundlesWithBudgets),
    budgetStatus: getBudgetStatus(bundlesWithBudgets),
    analysisType: config.analysis.target,
  };
};

/**
 * Save build data to database
 * @param result - Audit result
 */
const saveBuildToDatabase = async (result: AuditResult): Promise<void> => {
  try {
    const ciContext = CIIntegration.detectCIEnvironment();
    const db = new PerformanceDatabase();
    const buildId = db.saveBuild({
      timestamp: result.timestamp,
      branch: ciContext.branch,
      commitHash: ciContext.commitHash,
      bundles: result.bundles,
      recommendations: result.recommendations,
    });
    db.close();
    Logger.debug(`Build saved with ID: ${buildId}`);
  } catch {
    Logger.warn('Failed to save build to database');
  }
};

/**
 * Generate reports based on specified format
 * @param result - Audit result
 * @param options - Analysis options
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 */
const generateReports = async (
  result: AuditResult,
  options: AnalyzeOptions,
  config: any,
  pluginManager: PluginManager,
): Promise<void> => {
  await pluginManager.executeHook('beforeReport', {
    result,
    format: options.format,
  } as BeforeReportContext);

  const totalSizes = BundleAnalyzer.calculateTotalSize(result.bundles);

  switch (options.format) {
    case 'json':
      await generateJsonReport(result, config, pluginManager);
      break;
    case 'html':
      await generateHtmlReport(result, config, pluginManager);
      break;
    case 'console':
    default:
      await generateConsoleReport(result, totalSizes, options, config, pluginManager);
      break;
  }
};

/**
 * Generate JSON report
 * @param result - Audit result
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 */
const generateJsonReport = async (
  result: AuditResult,
  config: any,
  pluginManager: PluginManager,
): Promise<void> => {
  const outputPath = path.join(config.reports.outputDir, `bundle-analysis-${Date.now()}.json`);
  ReportGenerator.generateJsonReport(result, outputPath);
  Logger.success(`JSON report saved to: ${outputPath}`);
  Logger.json(result);
  await pluginManager.executeHook('afterReport', { result, outputPath } as AfterReportContext);
};

/**
 * Generate HTML report
 * @param result - Audit result
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 */
const generateHtmlReport = async (
  result: AuditResult,
  config: any,
  pluginManager: PluginManager,
): Promise<void> => {
  const outputPath = path.join(config.reports.outputDir, `bundle-analysis-${Date.now()}.html`);
  ReportGenerator.generateHtmlReport(result, outputPath);
  Logger.success(`HTML report saved to: ${outputPath}`);
  Logger.info('Open the HTML file in your browser to view the detailed report.');
  await pluginManager.executeHook('afterReport', { result, outputPath } as AfterReportContext);
};

/**
 * Generate console report
 * @param result - Audit result
 * @param totalSizes - Total bundle sizes
 * @param options - Analysis options
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 */
const generateConsoleReport = async (
  result: AuditResult,
  totalSizes: any,
  options: AnalyzeOptions,
  config: any,
  pluginManager: PluginManager,
): Promise<void> => {
  const reporter = new ConsoleReporter(config);
  reporter.reportBundleAnalysis(result, totalSizes, options.details || false);
  await pluginManager.executeHook('afterReport', {
    result,
    outputPath: 'console',
  } as AfterReportContext);
};

/**
 * Output CI annotations and summaries
 * @param result - Audit result
 */
const outputCIResults = async (result: AuditResult): Promise<void> => {
  const ciContext = CIIntegration.detectCIEnvironment();
  CIIntegration.outputCIAnnotations(result, ciContext);
};

/**
 * Handle analysis errors
 * @param spinner - Ora spinner instance
 * @param error - Error object
 */
const handleAnalysisError = async (spinner: any, error: unknown): Promise<void> => {
  spinner.fail('Analysis failed');
  Logger.error(error instanceof Error ? error.message : 'Unknown error');

  try {
    const config = await loadConfig();
    const pluginManager = new PluginManager(config);
    await pluginManager.loadPlugins();
    await pluginManager.executeHook('onError', {
      error: error as Error,
      context: 'analysis',
    } as ErrorContext);
    await pluginManager.unloadPlugins();
  } catch {
    // Ignore plugin errors during error handling
  }

  process.exit(1);
};

/**
 * Generate performance recommendations based on bundle analysis
 * @param bundles - Array of analyzed bundles
 * @returns Array of recommendation strings
 */
const generateRecommendations = (bundles: BundleInfo[]): string[] => {
  const recommendations: string[] = [];

  const clientRecommendations = generateClientRecommendations(bundles);
  const serverRecommendations = generateServerRecommendations(bundles);

  recommendations.push(...clientRecommendations, ...serverRecommendations);

  return recommendations;
};

/**
 * Generate client-side recommendations
 * @param bundles - Array of bundles
 * @returns Array of client recommendation strings
 */
const generateClientRecommendations = (bundles: BundleInfo[]): string[] => {
  const recommendations: string[] = [];
  const clientBundles = bundles.filter(b => b.type === 'client');

  if (clientBundles.length === 0) {
    return recommendations;
  }

  const largeClientBundles = clientBundles.filter(b => b.size > LARGE_CLIENT_BUNDLE_THRESHOLD);
  if (largeClientBundles.length > 0) {
    recommendations.push(
      `[Client] Consider code splitting for large bundles: ${largeClientBundles.map(b => b.name).join(', ')}`,
    );
  }

  const similarClientChunks = clientBundles.filter(
    b => b.name.includes('chunk') && b.size < SMALL_CHUNK_THRESHOLD,
  );
  if (similarClientChunks.length > MIN_SMALL_CHUNKS_FOR_RECOMMENDATION) {
    recommendations.push(`[Client] Consider merging small chunks to reduce HTTP requests`);
  }

  return recommendations;
};

/**
 * Generate server-side recommendations
 * @param bundles - Array of bundles
 * @returns Array of server recommendation strings
 */
const generateServerRecommendations = (bundles: BundleInfo[]): string[] => {
  const recommendations: string[] = [];
  const serverBundles = bundles.filter(b => b.type === 'server');

  if (serverBundles.length === 0) {
    return recommendations;
  }

  const largeServerBundles = serverBundles.filter(b => b.size > LARGE_SERVER_BUNDLE_THRESHOLD);
  if (largeServerBundles.length > 0) {
    recommendations.push(
      `[Server] Consider optimizing large server bundles: ${largeServerBundles.map(b => b.name).join(', ')}`,
    );
  }

  const heavyServerBundles = serverBundles.filter(
    b => b.size > HEAVY_SERVER_BUNDLE_THRESHOLD && b.name.includes('node_modules'),
  );
  if (heavyServerBundles.length > 0) {
    recommendations.push(
      `[Server] Review server dependencies for optimization: ${heavyServerBundles.map(b => b.name).join(', ')}`,
    );
  }

  return recommendations;
};

/**
 * Determine overall budget status based on bundle statuses
 * @param bundles - Array of bundles with status
 * @returns Overall budget status
 */
const getBudgetStatus = (bundles: BundleInfo[]): 'ok' | 'warning' | 'error' => {
  const hasError = bundles.some(b => b.status === 'error');
  const hasWarning = bundles.some(b => b.status === 'warning');

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'ok';
};
