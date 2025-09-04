import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BundleAnalyzer } from '../../src/core/bundle-analyzer.js';
import type { BundleInfo } from '../../src/types/config.js';

describe('BundleAnalyzer', () => {
  let tempDir: string;
  let analyzer: BundleAnalyzer;

  beforeEach(() => {
    tempDir = testHelpers.createTempDir();
    analyzer = new BundleAnalyzer({
      outputPath: tempDir,
      gzip: true,
      ignorePaths: ['**/*.map'],
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('analyzeBundles', () => {
    it('should analyze JavaScript bundles correctly', async () => {
      // Create test files
      const mainJs = 'console.log("main bundle");'.repeat(100);
      const vendorJs = 'console.log("vendor bundle");'.repeat(50);

      fs.writeFileSync(path.join(tempDir, 'main.js'), mainJs);
      fs.writeFileSync(path.join(tempDir, 'vendor.js'), vendorJs);

      const bundles = await analyzer.analyzeBundles();

      expect(bundles).toHaveLength(2);
      expect(bundles.find(b => b.name === 'main.js')).toBeDefined();
      expect(bundles.find(b => b.name === 'vendor.js')).toBeDefined();

      const mainBundle = bundles.find(b => b.name === 'main.js')!;
      expect(mainBundle.size).toBeGreaterThan(0);
      expect(mainBundle.gzipSize).toBeGreaterThan(0);
      expect(mainBundle.gzipSize).toBeLessThan(mainBundle.size);
    });

    it('should ignore specified paths', async () => {
      fs.writeFileSync(path.join(tempDir, 'main.js'), 'content');
      fs.writeFileSync(path.join(tempDir, 'main.js.map'), 'sourcemap');

      const bundles = await analyzer.analyzeBundles();

      expect(bundles).toHaveLength(1);
      expect(bundles[0].name).toBe('main.js');
    });

    it('should handle empty directory gracefully', async () => {
      const bundles = await analyzer.analyzeBundles();
      expect(bundles).toHaveLength(0);
    });

    it('should analyze nested directories', async () => {
      const nestedDir = path.join(tempDir, 'chunks');
      fs.mkdirSync(nestedDir);
      fs.writeFileSync(path.join(nestedDir, 'chunk-1.js'), 'chunk content');
      fs.writeFileSync(path.join(tempDir, 'main.js'), 'main content');

      const bundles = await analyzer.analyzeBundles();

      expect(bundles).toHaveLength(2);
      expect(bundles.find(b => b.name === 'chunks/chunk-1.js')).toBeDefined();
      expect(bundles.find(b => b.name === 'main.js')).toBeDefined();
    });
  });

  describe('applyBudgets', () => {
    it('should apply budget constraints correctly', () => {
      const bundles: BundleInfo[] = [
        testHelpers.createMockBundle('main.js', 100 * 1024), // 100KB
        testHelpers.createMockBundle('vendor.js', 200 * 1024), // 200KB
      ];

      const budgets = {
        main: { max: '150KB', warning: '80KB' },
        vendor: { max: '150KB', warning: '100KB' },
      };

      const result = BundleAnalyzer.applyBudgets(bundles, budgets);

      expect(result[0].status).toBe('warning'); // main: 100KB > 80KB warning
      expect(result[1].status).toBe('error'); // vendor: 200KB > 150KB max
    });

    it('should handle missing budget configurations', () => {
      const bundles: BundleInfo[] = [
        testHelpers.createMockBundle('unknown.js', 50 * 1024),
      ];

      const budgets = {};
      const result = BundleAnalyzer.applyBudgets(bundles, budgets);

      expect(result[0].status).toBe('ok');
    });

    it('should parse size strings correctly', () => {
      const bundles: BundleInfo[] = [
        testHelpers.createMockBundle('main.js', 2 * 1024 * 1024), // 2MB
      ];

      const budgets = {
        main: { max: '1.5MB', warning: '1MB' },
      };

      const result = BundleAnalyzer.applyBudgets(bundles, budgets);
      expect(result[0].status).toBe('error');
    });
  });

  describe('calculateTotalSize', () => {
    it('should calculate total sizes correctly', () => {
      const bundles: BundleInfo[] = [
        testHelpers.createMockBundle('main.js', 100 * 1024, 30 * 1024),
        testHelpers.createMockBundle('vendor.js', 200 * 1024, 60 * 1024),
      ];

      const totals = BundleAnalyzer.calculateTotalSize(bundles);

      expect(totals.size).toBe(300 * 1024);
      expect(totals.gzipSize).toBe(90 * 1024);
    });

    it('should handle bundles without gzip sizes', () => {
      const bundles: BundleInfo[] = [
        testHelpers.createMockBundle('main.js', 100 * 1024),
      ];

      const totals = BundleAnalyzer.calculateTotalSize(bundles);

      expect(totals.size).toBe(100 * 1024);
      expect(totals.gzipSize).toBeUndefined();
    });
  });
});
