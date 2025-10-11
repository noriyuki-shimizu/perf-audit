import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BundleInfo, PerfAuditConfig } from '../../../src/types/config.ts';
import { applyBudgetsToAllBundles, createAuditResult, getBudgetStatus } from '../../../src/utils/bundle.ts';

vi.setConfig({ testTimeout: 100 });

// Mock BundleAnalyzer
vi.mock('../../../src/core/bundle-analyzer.ts', () => ({
  BundleAnalyzer: {
    applyBudgets: vi.fn((bundles: BundleInfo[]) => bundles.map(bundle => ({ ...bundle, status: 'ok' as const }))),
  },
}));

// Mock command helpers
vi.mock('../../../src/utils/command-helpers.ts', () => ({
  getCurrentTimestamp: vi.fn(() => '2023-01-01T00:00:00.000Z'),
}));

const { BundleAnalyzer } = await import('../../../src/core/bundle-analyzer.ts');

describe('bundle utils', () => {
  const mockConfig: PerfAuditConfig = {
    project: {
      client: { outputPath: 'dist/client' },
      server: { outputPath: 'dist/server' },
    },
    budgets: {
      client: { bundles: { main: '100KB', vendor: '200KB', total: '300KB' } },
      server: { bundles: { main: '100KB', vendor: '200KB', total: '300KB' } },
      lighthouse: { performance: 90, accessibility: 90, bestPractices: 90, seo: 90 },
      metrics: { fcp: 1000, lcp: 2000, cls: 0.1, tti: 3000 },
    },
    analysis: {
      target: 'both',
      gzip: true,
      ignorePaths: [],
    },
    reports: {
      outputDir: 'reports',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('applyBudgetsToAllBundles', () => {
    it('should apply budgets to client bundles only', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
        { name: 'vendor.js', size: 200000, status: 'ok', type: 'client' },
      ];

      const result = applyBudgetsToAllBundles(bundles, mockConfig);

      expect(BundleAnalyzer.applyBudgets).toHaveBeenCalledWith(
        bundles,
        mockConfig.budgets.client.bundles,
      );
      expect(result).toHaveLength(2);
      expect(result.every(b => b.type === 'client')).toBe(true);
    });

    it('should apply budgets to server bundles only', () => {
      const bundles: BundleInfo[] = [
        { name: 'server.js', size: 150000, status: 'ok', type: 'server' },
      ];

      const result = applyBudgetsToAllBundles(bundles, mockConfig);

      expect(BundleAnalyzer.applyBudgets).toHaveBeenCalledWith(
        bundles,
        mockConfig.budgets.server.bundles,
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('server');
    });

    it('should apply budgets to both client and server bundles', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
        { name: 'server.js', size: 150000, status: 'ok', type: 'server' },
      ];

      const result = applyBudgetsToAllBundles(bundles, mockConfig);

      expect(BundleAnalyzer.applyBudgets).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result.some(b => b.type === 'client')).toBe(true);
      expect(result.some(b => b.type === 'server')).toBe(true);
    });

    it('should handle empty bundles array', () => {
      const bundles: BundleInfo[] = [];

      const result = applyBudgetsToAllBundles(bundles, mockConfig);

      expect(BundleAnalyzer.applyBudgets).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  describe('getBudgetStatus', () => {
    it('should return "ok" when all bundles are ok', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
        { name: 'vendor.js', size: 200000, status: 'ok', type: 'client' },
      ];

      const result = getBudgetStatus(bundles);

      expect(result).toBe('ok');
    });

    it('should return "warning" when any bundle has warning', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
        { name: 'vendor.js', size: 200000, status: 'warning', type: 'client' },
      ];

      const result = getBudgetStatus(bundles);

      expect(result).toBe('warning');
    });

    it('should return "error" when any bundle has error', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
        { name: 'large.js', size: 500000, status: 'error', type: 'client' },
      ];

      const result = getBudgetStatus(bundles);

      expect(result).toBe('error');
    });

    it('should prioritize error over warning', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'warning', type: 'client' },
        { name: 'large.js', size: 500000, status: 'error', type: 'client' },
      ];

      const result = getBudgetStatus(bundles);

      expect(result).toBe('error');
    });

    it('should consider totalStatus when provided - error case', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
      ];

      const result = getBudgetStatus(bundles, 'error');

      expect(result).toBe('error');
    });

    it('should consider totalStatus when provided - warning case', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
      ];

      const result = getBudgetStatus(bundles, 'warning');

      expect(result).toBe('warning');
    });

    it('should return ok when both bundles and totalStatus are ok', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
      ];

      const result = getBudgetStatus(bundles, 'ok');

      expect(result).toBe('ok');
    });

    it('should handle empty bundles array', () => {
      const bundles: BundleInfo[] = [];

      const result = getBudgetStatus(bundles);

      expect(result).toBe('ok');
    });
  });

  describe('createAuditResult', () => {
    it('should create audit result with client bundles', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
        { name: 'vendor.js', size: 200000, status: 'warning', type: 'client' },
      ];

      const result = createAuditResult(bundles, mockConfig);

      expect(result).toEqual({
        timestamp: '2023-01-01T00:00:00.000Z',
        serverBundles: [],
        clientBundles: bundles,
        recommendations: [],
        budgetStatus: 'warning',
        analysisType: 'both',
      });
    });

    it('should create audit result with server bundles', () => {
      const bundles: BundleInfo[] = [
        { name: 'server.js', size: 150000, status: 'ok', type: 'server' },
      ];

      const result = createAuditResult(bundles, mockConfig);

      expect(result).toEqual({
        timestamp: '2023-01-01T00:00:00.000Z',
        serverBundles: bundles,
        clientBundles: [],
        recommendations: [],
        budgetStatus: 'ok',
        analysisType: 'both',
      });
    });

    it('should create audit result with both client and server bundles', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
        { name: 'server.js', size: 150000, status: 'ok', type: 'server' },
      ];

      const result = createAuditResult(bundles, mockConfig);

      expect(result.serverBundles).toHaveLength(1);
      expect(result.clientBundles).toHaveLength(1);
      expect(result.serverBundles[0].type).toBe('server');
      expect(result.clientBundles[0].type).toBe('client');
    });

    it('should include recommendations when provided', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
      ];
      const recommendations = ['Consider code splitting', 'Optimize images'];

      const result = createAuditResult(bundles, mockConfig, recommendations);

      expect(result.recommendations).toEqual(recommendations);
    });

    it('should use analysis target from config', () => {
      const bundles: BundleInfo[] = [
        { name: 'main.js', size: 100000, status: 'ok', type: 'client' },
      ];
      const clientConfig = {
        ...mockConfig,
        analysis: { ...mockConfig.analysis, target: 'client' as const },
      };

      const result = createAuditResult(bundles, clientConfig);

      expect(result.analysisType).toBe('client');
    });

    it('should handle empty bundles', () => {
      const bundles: BundleInfo[] = [];

      const result = createAuditResult(bundles, mockConfig);

      expect(result.serverBundles).toHaveLength(0);
      expect(result.clientBundles).toHaveLength(0);
      expect(result.budgetStatus).toBe('ok');
    });
  });
});
