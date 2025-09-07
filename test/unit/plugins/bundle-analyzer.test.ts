import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bundleAnalyzerPlugin } from '../../../src/plugins/bundle-analyzer.ts';

vi.setConfig({ testTimeout: 100 });

describe('bundleAnalyzerPlugin', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.store.clear();
  });

  describe('plugin configuration', () => {
    it('should have correct name', () => {
      expect(bundleAnalyzerPlugin.name).toBe('bundle-analyzer');
    });

    it('should have version 1.0.0', () => {
      expect(bundleAnalyzerPlugin.version).toBe('1.0.0');
    });

    it('should have description for bundle analysis', () => {
      expect(bundleAnalyzerPlugin.description).toBe('Provides detailed bundle analysis and recommendations');
    });

    it('should have afterBundleAnalysis hook', () => {
      expect(bundleAnalyzerPlugin.hooks.afterBundleAnalysis).toBeDefined();
    });

    it('should have beforeReport hook', () => {
      expect(bundleAnalyzerPlugin.hooks.beforeReport).toBeDefined();
    });
  });

  describe('afterBundleAnalysis hook', () => {
    it('should return early when data is null', async () => {
      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, null);

      expect(mockContext.store.get('insights')).toBeUndefined();
      expect(mockContext.logger.info).not.toHaveBeenCalled();
    });

    it('should not generate insights for normal-sized bundles', async () => {
      const data = {
        bundles: [
          { name: 'main.js', size: 50000 },
          { name: 'vendor.js', size: 100000 },
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      const insights = mockContext.store.get('insights');
      expect(insights).toEqual([]);
    });

    it('should detect many small bundles under 5KB', async () => {
      const data = {
        bundles: Array.from({ length: 6 }, (_, i) => ({
          name: `small${i}.js`,
          size: 4000,
        })),
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      const insights = mockContext.store.get('insights');
      expect(insights).toContain('📦 Many small bundles detected (6):');
      expect(insights).toContain('  Consider merging some chunks to reduce HTTP overhead');
    });

    it('should ignore runtime bundles when detecting small bundles', async () => {
      const data = {
        bundles: [
          { name: 'runtime.js', size: 2000 },
          { name: 'webpack-runtime.js', size: 3000 },
          { name: 'small1.js', size: 4000 },
          { name: 'small2.js', size: 4000 },
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      const insights = mockContext.store.get('insights');
      const smallBundleInsights = insights.filter((insight: string) => insight.includes('Many small bundles detected'));
      expect(smallBundleInsights).toHaveLength(0);
    });

    it('should detect potential duplicates with similar sizes', async () => {
      const data = {
        bundles: [
          { name: 'lib1.js', size: 100000 },
          { name: 'lib2.js', size: 105000 }, // Within 10% similarity
          { name: 'different.js', size: 50000 },
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      const insights = mockContext.store.get('insights');
      expect(insights).toContain('🔄 Potential duplicate dependencies:');
      expect(insights.some((insight: string) => insight.includes('lib1.js and lib2.js have similar sizes'))).toBe(true);
    });

    it('should not detect duplicates for chunk files', async () => {
      const data = {
        bundles: [
          { name: 'chunk-1.js', size: 100000 },
          { name: 'chunk-2.js', size: 105000 },
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      const insights = mockContext.store.get('insights');
      const duplicateInsights = insights.filter((insight: string) =>
        insight.includes('Potential duplicate dependencies')
      );
      expect(duplicateInsights).toHaveLength(0);
    });

    it('should not detect duplicates for small bundles under 20KB', async () => {
      const data = {
        bundles: [
          { name: 'small1.js', size: 15000 },
          { name: 'small2.js', size: 15500 },
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      const insights = mockContext.store.get('insights');
      const duplicateInsights = insights.filter((insight: string) =>
        insight.includes('Potential duplicate dependencies')
      );
      expect(duplicateInsights).toHaveLength(0);
    });

    it('should log when insights are generated', async () => {
      const data = {
        bundles: [
          { name: 'large.js', size: 250000 },
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      expect(mockContext.logger.info).toHaveBeenCalledWith('Bundle analysis insights generated');
    });

    it('should not log when no insights are generated', async () => {
      const data = {
        bundles: [
          { name: 'normal.js', size: 50000 },
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      expect(mockContext.logger.info).not.toHaveBeenCalled();
    });

    it('should handle complex analysis with multiple issues', async () => {
      const data = {
        bundles: [
          { name: 'huge.js', size: 300000 }, // Large bundle
          { name: 'lib1.js', size: 100000 }, // Potential duplicate
          { name: 'lib2.js', size: 105000 }, // Potential duplicate
          ...Array.from({ length: 6 }, (_, i) => ({ // Many small bundles
            name: `tiny${i}.js`,
            size: 3000,
          })),
        ],
      };

      await bundleAnalyzerPlugin.hooks.afterBundleAnalysis!(mockContext, data);

      const insights = mockContext.store.get('insights');
      expect(insights).toContain('🔍 Large bundles detected (1):');
      expect(insights).toContain('📦 Many small bundles detected (6):');
      expect(insights).toContain('🔄 Potential duplicate dependencies:');
      expect(mockContext.logger.info).toHaveBeenCalledWith('Bundle analysis insights generated');
    });
  });

  describe('beforeReport hook', () => {
    it('should return early when data is null', async () => {
      await bundleAnalyzerPlugin.hooks.beforeReport!(mockContext, null);

      // No error should be thrown
    });

    it('should add insights to recommendations when available', async () => {
      const insights = ['Test insight 1', 'Test insight 2'];
      mockContext.store.set('insights', insights);

      const data = {
        result: {
          recommendations: ['Existing recommendation'],
        },
      };

      await bundleAnalyzerPlugin.hooks.beforeReport!(mockContext, data);

      expect(data.result.recommendations).toEqual([
        'Existing recommendation',
        'Test insight 1',
        'Test insight 2',
      ]);
    });

    it('should handle missing insights gracefully', async () => {
      const data = {
        result: {
          recommendations: ['Existing recommendation'],
        },
      };

      await bundleAnalyzerPlugin.hooks.beforeReport!(mockContext, data);

      expect(data.result.recommendations).toEqual(['Existing recommendation']);
    });

    it('should handle empty insights array', async () => {
      mockContext.store.set('insights', []);

      const data = {
        result: {
          recommendations: ['Existing recommendation'],
        },
      };

      await bundleAnalyzerPlugin.hooks.beforeReport!(mockContext, data);

      expect(data.result.recommendations).toEqual(['Existing recommendation']);
    });
  });
});
