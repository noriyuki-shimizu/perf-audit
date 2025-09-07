import { BundleAnalyzer } from '../core/bundle-analyzer.ts';
import type { BudgetStatus } from '../types/commands.ts';
import type { AuditResult, BundleInfo, PerfAuditConfig } from '../types/config.ts';
import { getCurrentTimestamp } from './command-helpers.ts';

/**
 * Apply budgets to all bundles based on their type (client/server)
 * @param bundles - Array of bundle information
 * @param config - Performance audit configuration
 * @returns Array of bundles with applied budgets
 */
export const applyBudgetsToAllBundles = (bundles: BundleInfo[], config: PerfAuditConfig): BundleInfo[] => {
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
 * Get overall budget status from bundles
 * @param bundles - Array of bundles with status
 * @param totalStatus - Optional total budget status (for budget command)
 * @returns Combined budget status
 */
export const getBudgetStatus = (bundles: BundleInfo[], totalStatus?: BudgetStatus): BudgetStatus => {
  const bundleHasError = bundles.some(b => b.status === 'error');
  const bundleHasWarning = bundles.some(b => b.status === 'warning');

  if (totalStatus) {
    // budget.ts version with totalStatus
    const hasError = bundleHasError || totalStatus === 'error';
    const hasWarning = bundleHasWarning || totalStatus === 'warning';

    if (hasError) return 'error';
    if (hasWarning) return 'warning';
    return 'ok';
  } else {
    // analyze.ts and watch.ts version
    if (bundleHasError) return 'error';
    if (bundleHasWarning) return 'warning';
    return 'ok';
  }
};

/**
 * Create audit result object
 * @param bundlesWithBudgets - Bundles with budget status applied
 * @param config - Application configuration
 * @param recommendations - Optional recommendations array
 * @returns Audit result object
 */
export const createAuditResult = (
  bundlesWithBudgets: BundleInfo[],
  config: PerfAuditConfig,
  recommendations: string[] = [],
): AuditResult => {
  return {
    timestamp: getCurrentTimestamp(),
    bundles: bundlesWithBudgets,
    recommendations,
    budgetStatus: getBudgetStatus(bundlesWithBudgets),
    analysisType: config.analysis.target,
  };
};
