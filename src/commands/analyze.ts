import path from 'path';
import {
  HEAVY_SERVER_BUNDLE_THRESHOLD,
  LARGE_CLIENT_BUNDLE_THRESHOLD,
  LARGE_SERVER_BUNDLE_THRESHOLD,
  MIN_SMALL_CHUNKS_FOR_RECOMMENDATION,
  SMALL_CHUNK_THRESHOLD,
} from '../constants/index.ts';
import { BundleAnalyzer } from '../core/bundle-analyzer.ts';
import { PluginManager } from '../core/plugin-system.ts';
import type {
  AfterAnalysisContext,
  AfterBundleAnalysisContext,
  AnalyzeOptions,
  BeforeReportContext,
  BundleAnalysisContext,
} from '../types/commands.ts';
import type { AuditResult, BundleInfo, PerfAuditConfig } from '../types/config.ts';
import { applyBudgetsToAllBundles, createAuditResult } from '../utils/bundle.ts';
import { CIIntegration } from '../utils/ci-integration.ts';
import {
  completeCommand,
  handleCommandError,
  initializeCommand,
  initializePluginManager,
  saveBuildData,
} from '../utils/command-helpers.ts';
import { Logger } from '../utils/logger.ts';
import { ReportGenerator } from '../utils/report-generator.ts';
import { ConsoleReporter } from '../utils/reporter.ts';

/**
 * Execute bundle analysis command
 * @param options - Analysis options
 */
export const analyzeCommand = async (options: AnalyzeOptions): Promise<void> => {
  const { config, spinner } = await initializeCommand();

  try {
    const pluginManager = await initializePluginManager(config);

    await pluginManager.executeHook('beforeAnalysis', { config });

    spinner.text = 'Analyzing bundles...';

    const bundles = await analyzeBundles(config, pluginManager);

    if (bundles.length === 0) {
      spinner.fail('No bundles found for analysis');
      Logger.warn('Make sure your project has been built and the output path is correct.');
      return;
    }

    const bundlesWithBudgets = applyBudgetsToAllBundles(bundles, config);
    const recommendations = generateRecommendations(bundlesWithBudgets);
    const result = createAuditResult(bundlesWithBudgets, config, recommendations);

    await saveBuildData(result);
    await pluginManager.executeHook('afterAnalysis', { result } as AfterAnalysisContext);

    completeCommand(spinner, 'Bundle analysis completed');

    await generateReports(result, options, config, pluginManager);
    await outputCIResults(result);
    await pluginManager.unloadPlugins();
  } catch (error) {
    await handleCommandError(spinner, error, 'Analysis failed', config);
  }
};

/**
 * Analyze bundles for both client and server
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 * @returns Array of analyzed bundles
 */
const analyzeBundles = async (config: PerfAuditConfig, pluginManager: PluginManager): Promise<BundleInfo[]> => {
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
const analyzeClientBundles = async (config: PerfAuditConfig, pluginManager: PluginManager): Promise<BundleInfo[]> => {
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
const analyzeServerBundles = async (config: PerfAuditConfig, pluginManager: PluginManager): Promise<BundleInfo[]> => {
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
 * Generate reports based on specified format
 * @param result - Audit result
 * @param options - Analysis options
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 */
const generateReports = async (
  result: AuditResult,
  options: AnalyzeOptions,
  config: PerfAuditConfig,
  pluginManager: PluginManager,
): Promise<void> => {
  await pluginManager.executeHook('beforeReport', {
    result,
    format: options.format,
  } as BeforeReportContext);

  switch (options.format) {
    case 'json':
      await generateJsonReport(result, config, pluginManager);
      break;
    case 'html':
      await generateHtmlReport(result, config, pluginManager);
      break;
    case 'console':
    default:
      await generateConsoleReport(result, options, config, pluginManager);
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
  config: PerfAuditConfig,
  pluginManager: PluginManager,
): Promise<void> => {
  const outputPath = path.join(config.reports.outputDir, `bundle-analysis-${Date.now()}.json`);
  ReportGenerator.generateJsonReport(result, outputPath);
  Logger.success(`JSON report saved to: ${outputPath}`);
  Logger.json(result);
  await pluginManager.executeHook('afterReport', { result, outputPath });
};

/**
 * Generate HTML report
 * @param result - Audit result
 * @param config - Configuration object
 * @param pluginManager - Plugin manager instance
 */
const generateHtmlReport = async (
  result: AuditResult,
  config: PerfAuditConfig,
  pluginManager: PluginManager,
): Promise<void> => {
  const outputPath = path.join(config.reports.outputDir, `bundle-analysis-${Date.now()}.html`);
  ReportGenerator.generateHtmlReport(result, outputPath);
  Logger.success(`HTML report saved to: ${outputPath}`);
  Logger.info('Open the HTML file in your browser to view the detailed report.');
  await pluginManager.executeHook('afterReport', { result, outputPath });
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
  options: AnalyzeOptions,
  config: PerfAuditConfig,
  pluginManager: PluginManager,
): Promise<void> => {
  const reporter = new ConsoleReporter(config);
  reporter.reportBundleAnalysis(result, options.details || false);
  await pluginManager.executeHook('afterReport', {
    result,
    outputPath: 'console',
  });
};

/**
 * Output CI annotations and summaries
 * @param result - Audit result
 */
const outputCIResults = async (result: AuditResult): Promise<void> => {
  const ciContext = CIIntegration.detectCIEnvironment();
  await CIIntegration.outputCIAnnotations(result, ciContext);
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
