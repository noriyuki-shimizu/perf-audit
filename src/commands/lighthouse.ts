import ora from 'ora';
import path from 'path';
import { PerformanceDatabase } from '../core/database.js';
import { LighthouseRunner } from '../core/lighthouse-runner.js';
import { AuditResult } from '../types/config.js';
import { loadConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { ReportGenerator } from '../utils/report-generator.js';
import { ConsoleReporter } from '../utils/reporter.js';

interface LighthouseOptions {
  device: 'mobile' | 'desktop';
  throttling: boolean;
  format: 'json' | 'console';
}

export async function lighthouseCommand(url: string, options: LighthouseOptions): Promise<void> {
  const spinner = ora('Loading configuration...').start();

  // Validate URL
  if (!LighthouseRunner.validateUrl(url)) {
    spinner.fail('Invalid URL provided');
    Logger.error('Please provide a valid HTTP or HTTPS URL');
    process.exit(1);
  }

  try {
    const config = await loadConfig();
    spinner.text = `Running Lighthouse audit for ${options.device} device...`;

    const runner = new LighthouseRunner();
    const result = await runner.runAudit({
      url,
      device: options.device,
      throttling: options.throttling,
      outputFormat: options.format === 'json' ? 'json' : undefined,
    });

    // Apply budgets to determine status
    const budgetStatus = evaluatePerformanceBudgets(result, config.budgets);

    // Create audit result
    const auditResult: AuditResult = {
      timestamp: new Date().toISOString(),
      bundles: [], // No bundle data for lighthouse-only audits
      lighthouse: result,
      recommendations: generatePerformanceRecommendations(result),
      budgetStatus,
    };

    // Save to database
    try {
      const db = new PerformanceDatabase();
      const buildId = db.saveBuild({
        timestamp: auditResult.timestamp,
        url,
        device: options.device,
        bundles: [],
        metrics: result,
        recommendations: auditResult.recommendations,
      });
      db.close();
      Logger.debug(`Lighthouse audit saved with ID: ${buildId}`);
    } catch {
      Logger.warn('Failed to save audit to database');
    }

    spinner.succeed('Lighthouse audit completed');

    // Output results
    switch (options.format) {
      case 'json': {
        const outputPath = path.join(config.reports.outputDir, `lighthouse-${options.device}-${Date.now()}.json`);
        ReportGenerator.generateJsonReport(auditResult, outputPath);
        Logger.success(`JSON report saved to: ${outputPath}`);

        const output = {
          url,
          device: options.device,
          throttling: options.throttling,
          timestamp: auditResult.timestamp,
          scores: {
            performance: result.performance,
            accessibility: result.accessibility,
            bestPractices: result.bestPractices,
            seo: result.seo,
          },
          metrics: result.metrics,
          budgetStatus: auditResult.budgetStatus,
          recommendations: auditResult.recommendations,
          ...(result.rawResult && { rawLighthouseResult: result.rawResult }),
        };
        Logger.json(output);
        break;
      }
      case 'console':
      default: {
        const reporter = new ConsoleReporter(config);
        Logger.title(`Lighthouse Audit Results for: ${url}`);
        Logger.info(`Device: ${options.device} | Throttling: ${options.throttling ? 'enabled' : 'disabled'}`);
        reporter.reportLighthouseResults(auditResult);
        break;
      }
    }

    // Set exit code based on budget status
    if (auditResult.budgetStatus === 'error') {
      process.exit(1);
    } else if (auditResult.budgetStatus === 'warning') {
      process.exit(2);
    }
  } catch (error) {
    spinner.fail('Lighthouse audit failed');
    Logger.error(error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof Error && error.message.includes('Chrome')) {
      Logger.warn('Tip: Make sure Google Chrome is installed and accessible');
    }

    process.exit(1);
  }
}

function evaluatePerformanceBudgets(
  metrics: any,
  budgets: any,
): 'ok' | 'warning' | 'error' {
  const { lighthouse: lighthouseBudgets, metrics: metricBudgets } = budgets;

  let hasError = false;
  let hasWarning = false;

  // Check Lighthouse category scores
  if (lighthouseBudgets.performance.min && metrics.performance < lighthouseBudgets.performance.min) {
    hasError = true;
  } else if (lighthouseBudgets.performance.warning && metrics.performance < lighthouseBudgets.performance.warning) {
    hasWarning = true;
  }

  if (lighthouseBudgets.accessibility?.min && metrics.accessibility < lighthouseBudgets.accessibility.min) {
    hasError = true;
  }

  if (lighthouseBudgets.seo?.min && metrics.seo < lighthouseBudgets.seo.min) {
    hasError = true;
  }

  // Check core web vitals
  if (metrics.metrics.fcp > metricBudgets.fcp.max) {
    hasError = true;
  } else if (metrics.metrics.fcp > metricBudgets.fcp.warning) {
    hasWarning = true;
  }

  if (metrics.metrics.lcp > metricBudgets.lcp.max) {
    hasError = true;
  } else if (metrics.metrics.lcp > metricBudgets.lcp.warning) {
    hasWarning = true;
  }

  if (metrics.metrics.cls > metricBudgets.cls.max) {
    hasError = true;
  } else if (metrics.metrics.cls > metricBudgets.cls.warning) {
    hasWarning = true;
  }

  if (metrics.metrics.tti > metricBudgets.tti.max) {
    hasError = true;
  } else if (metrics.metrics.tti > metricBudgets.tti.warning) {
    hasWarning = true;
  }

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'ok';
}

function generatePerformanceRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];

  if (metrics.performance < 90) {
    recommendations.push('Consider optimizing images and reducing JavaScript bundle size');
  }

  if (metrics.metrics.fcp > 2000) {
    recommendations.push('Improve First Contentful Paint by optimizing critical rendering path');
  }

  if (metrics.metrics.lcp > 2500) {
    recommendations.push('Reduce Largest Contentful Paint by optimizing images and server response times');
  }

  if (metrics.metrics.cls > 0.1) {
    recommendations.push('Fix layout shifts by setting image dimensions and avoiding dynamic content');
  }

  if (metrics.metrics.tti > 3500) {
    recommendations.push('Reduce Time to Interactive by minimizing JavaScript execution time');
  }

  if (metrics.accessibility < 95) {
    recommendations.push('Improve accessibility by adding alt text, proper headings, and ARIA labels');
  }

  if (metrics.seo < 90) {
    recommendations.push('Improve SEO by adding meta descriptions, proper heading structure, and structured data');
  }

  return recommendations;
}
