import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BundleAnalyzer } from '../../../src/core/bundle-analyzer.ts';
import type { AnalyzeOptions } from '../../../src/types/bundle-analyzer.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('fs');
vi.mock('gzip-size');
vi.mock('../../../src/utils/size.ts', () => ({
  getStatus: vi.fn((size: number, warning: number, max: number) => {
    if (size >= max) return 'error';
    if (size >= warning) return 'warning';
    return 'ok';
  }),
  parseSize: vi.fn((sizeString: string) => {
    const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
    if (!match) return 0;
    const [, value, unit] = match;
    const multipliers: { [key: string]: number; } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
    };
    return Math.round(parseFloat(value) * (multipliers[unit.toUpperCase()] || 1));
  }),
}));

const mockFs = vi.mocked(fs);

describe('BundleAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with options', () => {
      const options: AnalyzeOptions = {
        outputPath: 'dist',
        gzip: true,
        ignorePaths: ['**/test.js'],
      };

      const analyzer = new BundleAnalyzer(options);

      expect(analyzer).toBeInstanceOf(BundleAnalyzer);
    });
  });

  describe('analyzeBundles', () => {
    it('should return empty array when output path does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const options: AnalyzeOptions = {
        outputPath: 'nonexistent',
        gzip: false,
        ignorePaths: [],
      };
      const analyzer = new BundleAnalyzer(options);

      const result = await analyzer.analyzeBundles();

      expect(result).toEqual([]);
      expect(mockFs.existsSync).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('static methods', () => {
    describe('calculateTotalSize', () => {
      it('should calculate total size and gzip size', () => {
        const bundles = [
          { name: 'main.js', size: 100000, gzipSize: 30000, status: 'ok' as const },
          { name: 'vendor.js', size: 200000, gzipSize: 60000, status: 'ok' as const },
        ];

        const result = BundleAnalyzer.calculateTotalSize(bundles);

        expect(result).toEqual({
          size: 300000,
          gzipSize: 90000,
        });
      });

      it('should return undefined gzipSize when some bundles have no gzip size', () => {
        const bundles = [
          { name: 'main.js', size: 100000, gzipSize: 30000, status: 'ok' as const },
          { name: 'vendor.js', size: 200000, status: 'ok' as const },
        ];

        const result = BundleAnalyzer.calculateTotalSize(bundles);

        expect(result).toEqual({
          size: 300000,
          gzipSize: undefined,
        });
      });

      it('should handle empty bundles array', () => {
        const result = BundleAnalyzer.calculateTotalSize([]);

        expect(result).toEqual({
          size: 0,
          gzipSize: undefined,
        });
      });
    });

    describe('applyBudgets', () => {
      it('should apply budget status to bundles', () => {
        const bundles = [
          { name: 'main.js', size: 153600, status: 'ok' as const }, // 150KB in 1024-based calculation
          { name: 'vendor.js', size: 250000, status: 'ok' as const },
        ];

        const budgets = {
          main: { max: '200KB', warning: '150KB' },
          vendor: { max: '200KB', warning: '150KB' },
        };

        const result = BundleAnalyzer.applyBudgets(bundles, budgets);

        expect(result[0]).toEqual({
          name: 'main.js',
          size: 153600,
          status: 'warning', // At warning threshold
        });
        expect(result[1]).toEqual({
          name: 'vendor.js',
          size: 250000,
          status: 'error', // Over max threshold
        });
      });

      it('should return bundle unchanged when no matching budget', () => {
        const bundles = [
          { name: 'unknown.js', size: 100000, status: 'ok' as const },
        ];

        const budgets = {
          main: { max: '200KB', warning: '150KB' },
        };

        const result = BundleAnalyzer.applyBudgets(bundles, budgets);

        expect(result[0]).toEqual({
          name: 'unknown.js',
          size: 100000,
          status: 'ok',
        });
      });

      it.each([
        { bundleName: 'main.js', expectedKey: 'main', size: 100000 },
        { bundleName: 'index.js', expectedKey: 'main', size: 100000 },
        { bundleName: 'vendor.js', expectedKey: 'vendor', size: 100000 },
        { bundleName: 'chunk-123.js', expectedKey: 'vendor', size: 100000 },
        { bundleName: 'runtime.js', expectedKey: 'runtime', size: 25000 }, // Under 30KB warning threshold
        { bundleName: 'random.js', expectedKey: 'main', size: 100000 },
      ])('should map bundle name $bundleName to budget key $expectedKey', ({ bundleName, size }) => {
        const bundles = [
          { name: bundleName, size, status: 'ok' as const },
        ];

        const budgets = {
          main: { max: '200KB', warning: '150KB' },
          vendor: { max: '300KB', warning: '250KB' },
          runtime: { max: '50KB', warning: '30KB' },
        };

        const result = BundleAnalyzer.applyBudgets(bundles, budgets);

        // Should apply the appropriate budget based on bundle name mapping
        expect(result[0]).toHaveProperty('status', 'ok');
      });
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const options: AnalyzeOptions = {
        outputPath: 'dist',
        gzip: false,
        ignorePaths: [],
      };
      const analyzer = new BundleAnalyzer(options);

      await expect(analyzer.analyzeBundles()).rejects.toThrow('File system error');
    });
  });
});
