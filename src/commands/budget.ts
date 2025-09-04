import ora from 'ora';
import { BundleAnalyzer } from '../core/bundle-analyzer.js';
import { AuditResult } from '../types/config.js';
import { CIIntegration } from '../utils/ci-integration.js';
import { loadConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { ConsoleReporter } from '../utils/reporter.js';

interface BudgetOptions {
  format: 'json' | 'console';
}

export async function budgetCommand(options: BudgetOptions): Promise<void> {
  // Only use spinner for non-JSON output to avoid interfering with JSON
  const useSpinner = options.format !== 'json';
  const spinner = useSpinner ? ora('Loading configuration...').start() : null;

  try {
    const config = await loadConfig();
    if (useSpinner) {
      spinner!.text = 'Checking performance budgets...';
    }

    const analyzer = new BundleAnalyzer({
      outputPath: config.project.outputPath,
      gzip: config.analysis.gzip,
      ignorePaths: config.analysis.ignorePaths,
    });

    const bundles = await analyzer.analyzeBundles();

    if (bundles.length === 0) {
      if (useSpinner) {
        spinner!.fail('No bundles found for budget check');
      }
      if (options.format !== 'json') {
        Logger.warn('Make sure your project has been built and the output path is correct.');
      }
      return;
    }

    // Apply budgets to determine status
    const bundlesWithBudgets = BundleAnalyzer.applyBudgets(bundles, config.budgets.bundles);

    // Check total budget if defined
    const totalSizes = BundleAnalyzer.calculateTotalSize(bundlesWithBudgets);
    const totalBudget = config.budgets.bundles.total;
    let totalStatus: 'ok' | 'warning' | 'error' = 'ok';

    if (totalBudget) {
      const maxSize = parseSize(totalBudget.max);
      const warningSize = parseSize(totalBudget.warning);
      totalStatus = getStatus(totalSizes.size, warningSize, maxSize);
    }

    // Create audit result
    const result: AuditResult = {
      timestamp: new Date().toISOString(),
      bundles: bundlesWithBudgets,
      recommendations: [],
      budgetStatus: getBudgetStatus(bundlesWithBudgets, totalStatus),
    };

    // Detect CI environment for annotations
    const ciContext = CIIntegration.detectCIEnvironment();

    if (useSpinner) {
      spinner!.succeed('Budget check completed');
    }

    // Output results
    switch (options.format) {
      case 'json': {
        Logger.json({
          passed: result.budgetStatus === 'ok',
          status: result.budgetStatus,
          violations: result.bundles.filter(b => b.status !== 'ok'),
          timestamp: result.timestamp,
        });
        break;
      }
      case 'console':
      default: {
        const reporter = new ConsoleReporter(config);
        reporter.reportBudgetCheck(result);
        break;
      }
    }

    // Output CI annotations
    CIIntegration.outputCIAnnotations(result, ciContext);

    // Set exit code based on budget status
    if (result.budgetStatus === 'error') {
      process.exit(1);
    } else if (result.budgetStatus === 'warning') {
      process.exit(2); // Different exit code for warnings
    }
  } catch (error) {
    if (useSpinner) {
      spinner!.fail('Budget check failed');
    }
    if (options.format !== 'json') {
      Logger.error(error instanceof Error ? error.message : 'Unknown error');
    }
    process.exit(1);
  }
}

function getBudgetStatus(bundles: BundleInfo[], totalStatus: 'ok' | 'warning' | 'error'): 'ok' | 'warning' | 'error' {
  const bundleHasError = bundles.some(b => b.status === 'error');
  const bundleHasWarning = bundles.some(b => b.status === 'warning');

  // Combine bundle status with total status
  const hasError = bundleHasError || totalStatus === 'error';
  const hasWarning = bundleHasWarning || totalStatus === 'warning';

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'ok';
}

// Import utility functions
function parseSize(sizeString: string): number {
  const units: { [key: string]: number; } = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
  };

  const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeString}`);
  }

  const [, value, unit] = match;
  const multiplier = units[unit.toUpperCase()] || 1;

  return Math.round(parseFloat(value) * multiplier);
}

function getStatus(current: number, warning: number, max: number): 'ok' | 'warning' | 'error' {
  if (current >= max) return 'error';
  if (current >= warning) return 'warning';
  return 'ok';
}

// Re-export types for use in this module
type BundleInfo = import('../types/config.js').BundleInfo;
