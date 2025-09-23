import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditResult, PerfAuditConfig } from '../../../src/types/config.ts';
import { ConsoleReporter } from '../../../src/utils/reporter.ts';

vi.setConfig({ testTimeout: 100 });

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    blue: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    green: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
    gray: vi.fn((text: string) => text),
    dim: vi.fn((text: string) => text),
    bold: vi.fn((text: string) => text),
    cyan: vi.fn((text: string) => text),
  },
}));

// Mock size utils
vi.mock('../../../src/utils/size.ts', () => ({
  formatSize: vi.fn((size: number) => `${Math.round(size / 1024)}KB`),
  formatDelta: vi.fn((delta: number) => delta > 0 ? `+${Math.round(delta / 1024)}KB` : `${Math.round(delta / 1024)}KB`),
}));

describe('ConsoleReporter', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let reporter: ConsoleReporter;

  const mockConfig: PerfAuditConfig = {
    project: {
      client: { outputPath: 'dist' },
      server: { outputPath: 'dist-server' },
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
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    reporter = new ConsoleReporter(mockConfig);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('reportBundleAnalysis', () => {
    it('should report client bundle analysis', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'client',
        serverBundles: [],
        clientBundles: [
          {
            name: 'main.js',
            size: 100000,
            gzipSize: 30000,
            status: 'ok',
            type: 'client',
          },
          {
            name: 'vendor.js',
            size: 200000,
            gzipSize: 60000,
            status: 'warning',
            type: 'client',
          },
        ],
        budgetStatus: 'warning',
        recommendations: [],
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🎯 Performance Audit Report'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📦 Client-side Analysis'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📦 Client Bundles:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('main.js'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('vendor.js'));
    });

    it('should report server bundle analysis', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'server',
        serverBundles: [
          {
            name: 'server.js',
            size: 150000,
            gzipSize: 45000,
            status: 'ok',
            type: 'server',
          },
        ],
        clientBundles: [],
        budgetStatus: 'ok',
        recommendations: [],
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🖥️ Server-side Analysis'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🖥️ Server Bundles:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('server.js'));
    });

    it('should report both client and server analysis', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'both',
        serverBundles: [
          {
            name: 'server.js',
            size: 150000,
            status: 'ok',
            type: 'server',
          },
        ],
        clientBundles: [
          {
            name: 'main.js',
            size: 100000,
            status: 'ok',
            type: 'client',
          },
        ],
        budgetStatus: 'ok',
        recommendations: [],
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📦🖥️ Client & Server Analysis'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🖥️ Server Bundles:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📦 Client Bundles:'));
    });

    it('should show recommendations when available', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'client',
        serverBundles: [],
        clientBundles: [],
        budgetStatus: 'warning',
        recommendations: [
          'Consider code splitting',
          'Optimize images',
        ],
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('💡 Recommendations:'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Consider code splitting'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Optimize images'));
    });

    it('should show lighthouse metrics when available', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'client',
        serverBundles: [],
        clientBundles: [],
        budgetStatus: 'ok',
        recommendations: [],
        lighthouse: {
          performance: 85,
          accessibility: 90,
          bestPractices: 88,
          seo: 92,
          metrics: {
            fcp: 1200,
            lcp: 2000,
            cls: 0.08,
            tti: 3000,
          },
        },
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Performance Metrics'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Performance Score: 85'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('FCP: 1200ms'));
    });

    it('should show budget status', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'client',
        serverBundles: [],
        clientBundles: [],
        budgetStatus: 'error',
        recommendations: [],
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Budget violations detected!'));
    });

    it('should handle showDetails parameter', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'client',
        serverBundles: [],
        clientBundles: [
          {
            name: 'large.js',
            size: 500000,
            status: 'error',
            type: 'client',
          },
        ],
        budgetStatus: 'error',
        recommendations: [],
      };

      reporter.reportBundleAnalysis(result, true);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle empty bundles', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'both',
        serverBundles: [],
        clientBundles: [],
        budgetStatus: 'ok',
        recommendations: [],
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🎯 Performance Audit Report'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ All checks passed!'));
    });

    it('should handle bundles with delta information', () => {
      const result: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        analysisType: 'client',
        serverBundles: [],
        clientBundles: [
          {
            name: 'main.js',
            size: 100000,
            gzipSize: 30000,
            status: 'ok',
            type: 'client',
            delta: 5000, // 5KB increase
          },
        ],
        budgetStatus: 'ok',
        recommendations: [],
      };

      reporter.reportBundleAnalysis(result);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('main.js'));
    });
  });
});
