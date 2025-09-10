import ora from 'ora';
import { ERROR_EXIT_CODE, SIZE_UNITS, WARNING_EXIT_CODE } from '../constants/index.ts';
import { BundleAnalyzer } from '../core/bundle-analyzer.ts';
import type { BudgetJsonOutput, BudgetOptions, BudgetStatus, BundleType } from '../types/commands.ts';
import type { AuditResult, BundleInfo, PerfAuditConfig } from '../types/config.ts';
import { applyBudgetsToAllBundles, getBudgetStatus } from '../utils/bundle.ts';
import { CIIntegration } from '../utils/ci-integration.ts';
import { getCurrentTimestamp } from '../utils/command-helpers.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';
import { ConsoleReporter } from '../utils/reporter.ts';

/**
 * Execute performance budget check command
 * @param options - Budget check options
 */
export const budgetCommand = async (options: BudgetOptions): Promise<void> => {
  const useSpinner = shouldUseSpinner(options.format);
  const spinner = createSpinner(useSpinner);

  try {
    const config = await loadConfig();
    updateSpinnerText(spinner, 'Checking performance budgets...');

    const bundles = await analyzeBundlesForBudget(config);

    if (bundles.length === 0) {
      handleNoBundles(spinner, useSpinner, options.format);
      return;
    }

    const bundlesWithBudgets = applyBudgetsToAllBundles(bundles, config);
    const totalStatus = calculateTotalBudgetStatus(bundles, config);

    const result = createBudgetAuditResult(bundlesWithBudgets, totalStatus, config);
    const ciContext = CIIntegration.detectCIEnvironment();

    succeedSpinner(spinner, 'Budget check completed');

    await generateBudgetReport(result, options, config);
    CIIntegration.outputCIAnnotations(result, ciContext);

    exitWithBudgetStatus(result.budgetStatus);
  } catch (error) {
    handleBudgetError(spinner, useSpinner, options.format, error);
  }
};

/**
 * Determine if spinner should be used based on output format
 * @param format - Output format
 * @returns Whether to use spinner
 */
const shouldUseSpinner = (format: string): boolean => format !== 'json';

/**
 * Create spinner instance if needed
 * @param useSpinner - Whether to use spinner
 * @returns Spinner instance or null
 */
const createSpinner = (useSpinner: boolean): unknown => {
  return useSpinner ? ora('Loading configuration...').start() : null;
};

/**
 * Update spinner text if spinner is active
 * @param spinner - Spinner instance
 * @param text - Text to display
 */
const updateSpinnerText = (spinner: unknown, text: string): void => {
  if (spinner) {
    (spinner as { text: string; }).text = text;
  }
};

/**
 * Mark spinner as successful if active
 * @param spinner - Spinner instance
 * @param text - Success message
 */
const succeedSpinner = (spinner: unknown, text: string): void => {
  if (spinner) {
    (spinner as { succeed: (text: string) => void; }).succeed(text);
  }
};

/**
 * Analyze bundles for budget checking
 * @param config - Application configuration
 * @returns Array of analyzed bundles
 */
const analyzeBundlesForBudget = async (config: unknown): Promise<BundleInfo[]> => {
  const allBundles: BundleInfo[] = [];
  const analysisTarget = (config as { analysis: { target: BundleType; }; }).analysis.target;

  if (analysisTarget === 'client' || analysisTarget === 'both') {
    const clientBundles = await analyzeClientBundlesForBudget(config);
    allBundles.push(...clientBundles);
  }

  if (analysisTarget === 'server' || analysisTarget === 'both') {
    const serverBundles = await analyzeServerBundlesForBudget(config);
    allBundles.push(...serverBundles);
  }

  return allBundles;
};

/**
 * Analyze client bundles for budget checking
 * @param config - Application configuration
 * @returns Array of client bundles with type annotation
 */
const analyzeClientBundlesForBudget = async (config: unknown): Promise<BundleInfo[]> => {
  const configTyped = config as {
    project: { client: { outputPath: string; }; };
    analysis: { gzip: boolean; ignorePaths: string[]; };
  };

  const clientAnalyzer = new BundleAnalyzer({
    outputPath: configTyped.project.client.outputPath,
    gzip: configTyped.analysis.gzip,
    ignorePaths: configTyped.analysis.ignorePaths,
  });

  const clientBundles = await clientAnalyzer.analyzeBundles();
  return clientBundles.map(bundle => ({ ...bundle, type: 'client' as const }));
};

/**
 * Analyze server bundles for budget checking
 * @param config - Application configuration
 * @returns Array of server bundles with type annotation
 */
const analyzeServerBundlesForBudget = async (config: unknown): Promise<BundleInfo[]> => {
  const configTyped = config as {
    project: { server: { outputPath: string; }; };
    analysis: { gzip: boolean; ignorePaths: string[]; };
  };

  const serverAnalyzer = new BundleAnalyzer({
    outputPath: configTyped.project.server.outputPath,
    gzip: configTyped.analysis.gzip,
    ignorePaths: configTyped.analysis.ignorePaths,
  });

  const serverBundles = await serverAnalyzer.analyzeBundles();
  return serverBundles.map(bundle => ({ ...bundle, type: 'server' as const }));
};

/**
 * Handle case when no bundles are found
 * @param spinner - Spinner instance
 * @param useSpinner - Whether spinner is being used
 * @param format - Output format
 */
const handleNoBundles = (spinner: unknown, useSpinner: boolean, format: string): void => {
  if (useSpinner) {
    (spinner as { fail: (text: string) => void; }).fail('No bundles found for budget check');
  }
  if (format !== 'json') {
    Logger.warn('Make sure your project has been built and the output path is correct.');
  }
};

/**
 * Calculate total budget status for client and server
 * @param bundles - Array of bundles
 * @param config - Application configuration
 * @returns Overall budget status
 */
const calculateTotalBudgetStatus = (bundles: BundleInfo[], config: unknown): BudgetStatus => {
  const clientBundles = bundles.filter(b => b.type === 'client');
  const serverBundles = bundles.filter(b => b.type === 'server');

  const configTyped = config as {
    budgets: {
      client: { bundles: { total?: { max: string; warning: string; }; }; };
      server: { bundles: { total?: { max: string; warning: string; }; }; };
    };
  };

  const clientTotalBudget = configTyped.budgets.client.bundles.total;
  const serverTotalBudget = configTyped.budgets.server.bundles.total;

  const clientTotalStatus = calculateBudgetStatusForType(clientBundles, clientTotalBudget);
  const serverTotalStatus = calculateBudgetStatusForType(serverBundles, serverTotalBudget);

  return combineBudgetStatus(clientTotalStatus, serverTotalStatus);
};

/**
 * Calculate budget status for specific bundle type
 * @param bundles - Array of bundles for specific type
 * @param totalBudget - Total budget configuration for the type
 * @returns Budget status for the type
 */
const calculateBudgetStatusForType = (
  bundles: BundleInfo[],
  totalBudget?: { max: string; warning: string; },
): BudgetStatus => {
  if (!totalBudget) {
    return 'ok';
  }

  const maxSize = parseSize(totalBudget.max);
  const warningSize = parseSize(totalBudget.warning);
  const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);

  return getStatus(totalSize, warningSize, maxSize);
};

/**
 * Combine multiple budget statuses into one
 * @param clientStatus - Client budget status
 * @param serverStatus - Server budget status
 * @returns Combined budget status
 */
const combineBudgetStatus = (clientStatus: BudgetStatus, serverStatus: BudgetStatus): BudgetStatus => {
  if (clientStatus === 'error' || serverStatus === 'error') {
    return 'error';
  }
  if (clientStatus === 'warning' || serverStatus === 'warning') {
    return 'warning';
  }
  return 'ok';
};

/**
 * Create audit result for budget checking
 * @param bundlesWithBudgets - Bundles with budget status applied
 * @param totalStatus - Overall total budget status
 * @param config - Application configuration
 * @returns Audit result object
 */
const createBudgetAuditResult = (
  bundlesWithBudgets: BundleInfo[],
  totalStatus: BudgetStatus,
  config: unknown,
): AuditResult => {
  const analysisTarget = (config as { analysis: { target: BundleType; }; }).analysis.target;

  return {
    timestamp: getCurrentTimestamp(),
    bundles: bundlesWithBudgets,
    recommendations: [],
    budgetStatus: getBudgetStatus(bundlesWithBudgets, totalStatus),
    analysisType: analysisTarget,
  };
};

/**
 * Generate budget report based on specified format
 * @param result - Audit result
 * @param options - Budget options
 * @param config - Application configuration
 */
const generateBudgetReport = async (
  result: AuditResult,
  options: BudgetOptions,
  config: PerfAuditConfig,
): Promise<void> => {
  switch (options.format) {
    case 'json':
      generateJsonBudgetReport(result);
      break;
    case 'console':
    default:
      generateConsoleBudgetReport(result, config);
      break;
  }
};

/**
 * Generate JSON format budget report
 * @param result - Audit result
 */
const generateJsonBudgetReport = (result: AuditResult): void => {
  const jsonOutput: BudgetJsonOutput = {
    passed: result.budgetStatus === 'ok',
    status: result.budgetStatus,
    violations: result.bundles.filter(b => b.status !== 'ok'),
    timestamp: result.timestamp,
  };
  Logger.json(jsonOutput);
};

/**
 * Generate console format budget report
 * @param result - Audit result
 * @param config - Application configuration
 */
const generateConsoleBudgetReport = (result: AuditResult, config: PerfAuditConfig): void => {
  const reporter = new ConsoleReporter(config);
  reporter.reportBudgetCheck(result);
};

/**
 * Exit with appropriate code based on budget status
 * @param budgetStatus - Overall budget status
 */
const exitWithBudgetStatus = (budgetStatus: BudgetStatus): void => {
  if (budgetStatus === 'error') {
    process.exit(ERROR_EXIT_CODE);
  } else if (budgetStatus === 'warning') {
    process.exit(WARNING_EXIT_CODE);
  }
};

/**
 * Handle budget checking errors
 * @param spinner - Spinner instance
 * @param useSpinner - Whether spinner is being used
 * @param format - Output format
 * @param error - Error object
 */
const handleBudgetError = (
  spinner: unknown,
  useSpinner: boolean,
  format: string,
  error: unknown,
): void => {
  if (useSpinner) {
    (spinner as { fail: (text: string) => void; }).fail('Budget check failed');
  }
  if (format !== 'json') {
    Logger.error(error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(ERROR_EXIT_CODE);
};

/**
 * Check if value is a supported size unit
 * @param value - Value to check
 * @returns Whether the value is a supported size unit
 */
const isSupportedSizeUnit = (value: unknown): value is keyof typeof SIZE_UNITS => {
  return typeof value === 'string' && value in SIZE_UNITS;
};

/**
 * Parse size string to bytes
 * @param sizeString - Size string with unit (e.g., "100KB")
 * @returns Size in bytes
 */
const parseSize = (sizeString: string): number => {
  const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeString}`);
  }

  const [, value, unit] = match;
  const unitKey = unit.toUpperCase();

  if (!isSupportedSizeUnit(unitKey)) {
    throw new Error(`Unsupported size unit: ${unit}`);
  }

  const multiplier = SIZE_UNITS[unitKey];

  return Math.round(parseFloat(value) * multiplier);
};

/**
 * Get status based on current size and thresholds
 * @param current - Current size in bytes
 * @param warning - Warning threshold in bytes
 * @param max - Maximum threshold in bytes
 * @returns Status based on thresholds
 */
const getStatus = (current: number, warning: number, max: number): BudgetStatus => {
  if (current >= max) return 'error';
  if (current >= warning) return 'warning';
  return 'ok';
};
