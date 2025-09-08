import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ciReporterPlugin } from '../../../src/plugins/ci-reporter.ts';

vi.setConfig({ testTimeout: 100 });

describe('ciReporterPlugin', () => {
  const mockContext = {
    config: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    emit: vi.fn(),
    store: new Map(),
  };

  const mockAnalysisData = {
    result: {
      bundles: [
        { name: 'main.js', size: 100000, gzipSize: 30000, status: 'ok' },
        { name: 'vendor.js', size: 200000, gzipSize: 60000, status: 'warning' },
        { name: 'large.js', size: 300000, gzipSize: 90000, status: 'error' },
      ],
      budgetStatus: 'warning',
      lighthouse: {
        performance: 85,
      },
    },
  };

  const mockErrorData = {
    error: new Error('Test error'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.store.clear();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
  });

  describe('plugin configuration', () => {
    it('should have correct name and version', () => {
      expect(ciReporterPlugin.name).toBe('ci-reporter');
    });

    it('should have version 1.0.0', () => {
      expect(ciReporterPlugin.version).toBe('1.0.0');
    });

    it('should have description for CI environments', () => {
      expect(ciReporterPlugin.description).toBe('Enhanced reporting for CI environments');
    });

    it('should have afterAnalysis hook', () => {
      expect(ciReporterPlugin.hooks.afterAnalysis).toBeDefined();
    });

    it('should have onError hook', () => {
      expect(ciReporterPlugin.hooks.onError).toBeDefined();
    });
  });

  describe('afterAnalysis hook', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return early when data is null', async () => {
      process.env.CI = 'true';

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, null);

      expect(mockContext.store.get('ciSummary')).toBeUndefined();
    });

    it('should return early when not in CI environment', async () => {
      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, mockAnalysisData);

      expect(mockContext.store.get('ciSummary')).toBeUndefined();
    });

    it.each([
      { env: 'CI', value: 'true' },
      { env: 'GITHUB_ACTIONS', value: 'true' },
      { env: 'GITLAB_CI', value: 'true' },
    ])('should process data when $env is set', async ({ env, value }) => {
      process.env[env] = value;

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, mockAnalysisData);

      const summary = mockContext.store.get('ciSummary');
      expect(summary).toBeDefined();
      expect(summary.status).toBe('warning');
      expect(summary.bundleCount).toBe(3);
    });

    it('should output GitHub Actions summary when in GitHub Actions', async () => {
      process.env.GITHUB_ACTIONS = 'true';
      const consoleSpy = vi.spyOn(console, 'log');

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, mockAnalysisData);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('## 📊 Performance Audit Summary'));
    });

    it('should output GitLab CI summary when in GitLab CI', async () => {
      process.env.GITLAB_CI = 'true';
      const consoleSpy = vi.spyOn(console, 'log');

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, mockAnalysisData);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Performance Audit'));
    });
  });

  describe('onError hook', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return early when data is null', async () => {
      process.env.CI = 'true';
      const consoleSpy = vi.spyOn(console, 'log');

      await ciReporterPlugin.hooks.onError!(mockContext, null);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should return early when not in CI environment', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await ciReporterPlugin.hooks.onError!(mockContext, mockErrorData);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should output GitHub Actions error annotation', async () => {
      process.env.GITHUB_ACTIONS = 'true';
      const consoleSpy = vi.spyOn(console, 'log');

      await ciReporterPlugin.hooks.onError!(mockContext, mockErrorData);

      expect(consoleSpy).toHaveBeenCalledWith('::error::Performance audit failed: Test error');
    });

    it('should output GitLab CI error format', async () => {
      process.env.GITLAB_CI = 'true';
      const consoleSpy = vi.spyOn(console, 'log');

      await ciReporterPlugin.hooks.onError!(mockContext, mockErrorData);

      expect(consoleSpy).toHaveBeenCalledWith('🚨 CI Error: Test error');
    });
  });

  describe('CI summary generation', () => {
    it('should generate summary with success status when no violations', async () => {
      process.env.CI = 'true';
      const dataWithoutViolations = {
        result: {
          bundles: [
            { name: 'main.js', size: 50000, gzipSize: 15000, status: 'ok' },
          ],
          budgetStatus: 'ok',
        },
      };

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, dataWithoutViolations);

      const summary = mockContext.store.get('ciSummary');
      expect(summary.status).toBe('success');
      expect(summary.violations).toHaveLength(0);
    });

    it('should generate summary with error status when budget is error', async () => {
      process.env.CI = 'true';
      const dataWithError = {
        result: {
          bundles: [{ name: 'main.js', size: 100000, gzipSize: 30000, status: 'ok' }],
          budgetStatus: 'error',
        },
      };

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, dataWithError);

      const summary = mockContext.store.get('ciSummary');
      expect(summary.status).toBe('error');
    });

    it('should include improvement suggestions for large bundles', async () => {
      process.env.CI = 'true';
      const dataWithLargeBundles = {
        result: {
          bundles: [
            { name: 'large1.js', size: 200000, gzipSize: 60000, status: 'ok' },
            { name: 'large2.js', size: 180000, gzipSize: 54000, status: 'ok' },
          ],
          budgetStatus: 'ok',
        },
      };

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, dataWithLargeBundles);

      const summary = mockContext.store.get('ciSummary');
      const codeSplittingSuggestion = summary.improvements.find(
        imp => imp.name === 'Code Splitting',
      );
      expect(codeSplittingSuggestion).toBeDefined();
      expect(codeSplittingSuggestion.description).toContain('2 bundle(s) are larger than 150KB');
    });

    it('should include improvement suggestions for many small bundles', async () => {
      process.env.CI = 'true';
      const dataWithSmallBundles = {
        result: {
          bundles: Array.from({ length: 6 }, (_, i) => ({
            name: `small${i}.js`,
            size: 5000,
            gzipSize: 1500,
            status: 'ok',
          })),
          budgetStatus: 'ok',
        },
      };

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, dataWithSmallBundles);

      const summary = mockContext.store.get('ciSummary');
      const consolidationSuggestion = summary.improvements.find(
        imp => imp.name === 'Bundle Consolidation',
      );
      expect(consolidationSuggestion).toBeDefined();
      expect(consolidationSuggestion.description).toContain('Consider merging small bundles');
    });

    it('should include performance score when available', async () => {
      process.env.CI = 'true';

      await ciReporterPlugin.hooks.afterAnalysis!(mockContext, mockAnalysisData);

      const summary = mockContext.store.get('ciSummary');
      expect(summary.performanceScore).toBe(85);
    });
  });
});
