import ora from 'ora';
import path from 'path';
import { BundleAnalyzer } from '../core/bundle-analyzer.ts';
import { PerformanceDatabase } from '../core/database.ts';
import { PluginManager } from '../core/plugin-system.ts';
import type { AnalyzeOptions } from '../types/commands.ts';
import type { AuditResult } from '../types/config.ts';
import { CIIntegration } from '../utils/ci-integration.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';
import { ReportGenerator } from '../utils/report-generator.ts';
import { ConsoleReporter } from '../utils/reporter.ts';

export async function analyzeCommand(options: AnalyzeOptions): Promise<void> {
  const spinner = ora('Loading configuration...').start();

  try {
    const config = await loadConfig();

    // Initialize plugin system
    const pluginManager = new PluginManager(config);
    await pluginManager.loadPlugins();

    // Execute beforeAnalysis hooks
    await pluginManager.executeHook('beforeAnalysis', { config });

    spinner.text = 'Analyzing bundles...';

    const analyzer = new BundleAnalyzer({
      outputPath: config.project.outputPath,
      gzip: config.analysis.gzip,
      ignorePaths: config.analysis.ignorePaths,
    });

    // Execute beforeBundleAnalysis hooks
    await pluginManager.executeHook('beforeBundleAnalysis', { outputPath: config.project.outputPath });

    const bundles = await analyzer.analyzeBundles();

    // Execute afterBundleAnalysis hooks
    await pluginManager.executeHook('afterBundleAnalysis', { bundles });

    if (bundles.length === 0) {
      spinner.fail('No bundles found for analysis');
      Logger.warn('Make sure your project has been built and the output path is correct.');
      return;
    }

    // Apply budgets to determine status
    const bundlesWithBudgets = BundleAnalyzer.applyBudgets(bundles, config.budgets.bundles);
    const totalSizes = BundleAnalyzer.calculateTotalSize(bundlesWithBudgets);

    // Create audit result
    const result: AuditResult = {
      timestamp: new Date().toISOString(),
      bundles: bundlesWithBudgets,
      recommendations: generateRecommendations(bundlesWithBudgets),
      budgetStatus: getBudgetStatus(bundlesWithBudgets),
    };

    // Detect CI environment and add context
    const ciContext = CIIntegration.detectCIEnvironment();

    // Save to database
    try {
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

    // Execute afterAnalysis hooks
    await pluginManager.executeHook('afterAnalysis', { result });

    spinner.succeed('Bundle analysis completed');

    // Execute beforeReport hooks
    await pluginManager.executeHook('beforeReport', { result, format: options.format });

    // Output results
    switch (options.format) {
      case 'json': {
        const outputPath = path.join(config.reports.outputDir, `bundle-analysis-${Date.now()}.json`);
        ReportGenerator.generateJsonReport(result, outputPath);
        Logger.success(`JSON report saved to: ${outputPath}`);
        Logger.json(result);
        // Execute afterReport hooks
        await pluginManager.executeHook('afterReport', { result, outputPath });
        break;
      }
      case 'html': {
        const outputPath = path.join(config.reports.outputDir, `bundle-analysis-${Date.now()}.html`);
        ReportGenerator.generateHtmlReport(result, outputPath);
        Logger.success(`HTML report saved to: ${outputPath}`);
        Logger.info('Open the HTML file in your browser to view the detailed report.');
        // Execute afterReport hooks
        await pluginManager.executeHook('afterReport', { result, outputPath });
        break;
      }
      case 'console':
      default: {
        const reporter = new ConsoleReporter(config);
        reporter.reportBundleAnalysis(result, totalSizes, options.details || false);
        // Execute afterReport hooks
        await pluginManager.executeHook('afterReport', { result, outputPath: 'console' });
        break;
      }
    }

    // Output CI annotations and summaries
    CIIntegration.outputCIAnnotations(result, ciContext);

    // Unload plugins
    await pluginManager.unloadPlugins();
  } catch (error) {
    spinner.fail('Analysis failed');
    Logger.error(error instanceof Error ? error.message : 'Unknown error');

    // Execute error hooks
    try {
      const config = await loadConfig();
      const pluginManager = new PluginManager(config);
      await pluginManager.loadPlugins();
      await pluginManager.executeHook('onError', { error: error as Error, context: 'analysis' });
      await pluginManager.unloadPlugins();
    } catch {
      // Ignore plugin errors during error handling
    }

    process.exit(1);
  }
}

function generateRecommendations(bundles: BundleInfo[]): string[] {
  const recommendations: string[] = [];

  // Check for large bundles
  const largeBundles = bundles.filter(b => b.size > 150 * 1024); // > 150KB
  if (largeBundles.length > 0) {
    recommendations.push(`Consider code splitting for large bundles: ${largeBundles.map(b => b.name).join(', ')}`);
  }

  // Check for similar sized chunks that could be merged
  const similarChunks = bundles.filter(b => b.name.includes('chunk') && b.size < 10 * 1024); // < 10KB
  if (similarChunks.length > 3) {
    recommendations.push(`Consider merging small chunks to reduce HTTP requests`);
  }

  return recommendations;
}

function getBudgetStatus(bundles: BundleInfo[]): 'ok' | 'warning' | 'error' {
  const hasError = bundles.some(b => b.status === 'error');
  const hasWarning = bundles.some(b => b.status === 'warning');

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'ok';
}

// Re-export BundleInfo type for use in this module
type BundleInfo = import('../types/config.ts').BundleInfo;
