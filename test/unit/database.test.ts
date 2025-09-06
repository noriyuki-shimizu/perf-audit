import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PerformanceDatabase } from '../../src/core/database.ts';
import type { BundleInfo, PerformanceMetrics } from '../../src/types/config.ts';

describe('PerformanceDatabase', () => {
  let tempDir: string;
  let dbPath: string;
  let db: PerformanceDatabase;

  beforeEach(() => {
    tempDir = testHelpers.createTempDir();
    dbPath = path.join(tempDir, 'test.db');

    // Pass the database path directly to the constructor
    db = new PerformanceDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('saveBuild', () => {
    it('should save build data correctly', () => {
      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        branch: 'main',
        commitHash: 'abc123',
        bundles: [
          testHelpers.createMockBundle('main.js', 100 * 1024, 30 * 1024),
          testHelpers.createMockBundle('vendor.js', 200 * 1024, 60 * 1024),
        ] as BundleInfo[],
        recommendations: ['Consider code splitting', 'Optimize images'],
        metrics: {
          performance: 85,
          accessibility: 95,
          bestPractices: 90,
          seo: 88,
          metrics: {
            fcp: 1200,
            lcp: 2100,
            cls: 0.05,
            tti: 3000,
          },
        } as PerformanceMetrics,
      };

      const buildId = db.saveBuild(buildData);

      expect(buildId).toBeTypeOf('number');
      expect(buildId).toBeGreaterThan(0);
    });

    it('should handle builds without metrics', () => {
      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [testHelpers.createMockBundle('main.js', 100 * 1024)] as BundleInfo[],
        recommendations: [],
      };

      const buildId = db.saveBuild(buildData);
      expect(buildId).toBeTypeOf('number');
    });
  });

  describe('getRecentBuilds', () => {
    beforeEach(() => {
      // Insert test data
      for (let i = 0; i < 5; i++) {
        db.saveBuild({
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          branch: `branch-${i}`,
          commitHash: `commit-${i}`,
          bundles: [testHelpers.createMockBundle(`bundle-${i}.js`, (i + 1) * 50 * 1024)] as BundleInfo[],
          recommendations: [],
        });
      }
    });

    it('should return recent builds in correct order', () => {
      const builds = db.getRecentBuilds(3);

      expect(builds).toHaveLength(3);
      // Since i=0 is most recent (Date.now() - 0), branch-0 should be first
      expect(builds[0].branch).toBe('branch-0'); // Most recent first
      expect(builds[1].branch).toBe('branch-1');
      expect(builds[2].branch).toBe('branch-2');
    });

    it('should include bundles and recommendations', () => {
      const builds = db.getRecentBuilds(1);
      const build = builds[0];

      expect(build.bundles).toHaveLength(1);
      expect(build.bundles[0].name).toBe('bundle-0.js');
      expect(build.recommendations).toBeDefined();
    });

    it('should respect limit parameter', () => {
      const builds = db.getRecentBuilds(2);
      expect(builds).toHaveLength(2);
    });
  });

  describe('getBuild', () => {
    let buildId: number;

    beforeEach(() => {
      buildId = db.saveBuild({
        timestamp: '2023-01-01T00:00:00.000Z',
        branch: 'test-branch',
        commitHash: 'test-commit',
        bundles: [testHelpers.createMockBundle('test.js', 100 * 1024)] as BundleInfo[],
        recommendations: ['Test recommendation'],
      });
    });

    it('should retrieve build by ID', () => {
      const build = db.getBuild(buildId);

      expect(build).toBeDefined();
      expect(build!.id).toBe(buildId);
      expect(build!.branch).toBe('test-branch');
      expect(build!.bundles).toHaveLength(1);
      expect(build!.recommendations).toContain('Test recommendation');
    });

    it('should return null for non-existent build', () => {
      const build = db.getBuild(99999);
      expect(build).toBeNull();
    });
  });

  describe('getTrendData', () => {
    beforeEach(() => {
      const now = new Date();
      for (let i = 0; i < 10; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        db.saveBuild({
          timestamp: date.toISOString(),
          bundles: [
            testHelpers.createMockBundle('bundle.js', (100 + i * 10) * 1024, (30 + i * 3) * 1024),
          ] as BundleInfo[],
          recommendations: [],
          metrics: {
            performance: 90 - i,
            metrics: {
              fcp: 1000 + i * 100,
              lcp: 2000 + i * 100,
              cls: 0.01 * i,
              tti: 3000 + i * 100,
            },
          } as PerformanceMetrics,
        });
      }
    });

    it('should return trend data for specified period', () => {
      const trends = db.getTrendData(7);

      expect(trends.length).toBeGreaterThan(0);
      expect(trends.length).toBeLessThanOrEqual(8); // Allow for edge cases in date boundaries

      const trend = trends[0];
      expect(trend).toHaveProperty('date');
      expect(trend).toHaveProperty('totalSize');
      expect(trend).toHaveProperty('gzipSize');
      expect(trend).toHaveProperty('performanceScore');
    });
  });

  describe('getBuildComparison', () => {
    let buildId1: number;
    let buildId2: number;

    beforeEach(() => {
      buildId1 = db.saveBuild({
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [
          testHelpers.createMockBundle('main.js', 100 * 1024, 30 * 1024),
          testHelpers.createMockBundle('vendor.js', 200 * 1024, 60 * 1024),
        ] as BundleInfo[],
        recommendations: [],
      });

      buildId2 = db.saveBuild({
        timestamp: '2023-01-02T00:00:00.000Z',
        bundles: [
          testHelpers.createMockBundle('main.js', 110 * 1024, 33 * 1024),
          testHelpers.createMockBundle('vendor.js', 180 * 1024, 54 * 1024),
        ] as BundleInfo[],
        recommendations: [],
      });
    });

    it('should compare builds and show differences', () => {
      const comparison = db.getBuildComparison(buildId1, buildId2);

      expect(comparison).toHaveProperty('build1');
      expect(comparison).toHaveProperty('build2');
      expect(comparison).toHaveProperty('bundleDiff');

      expect(comparison.bundleDiff).toHaveLength(2);

      const mainDiff = comparison.bundleDiff.find(d => d.name === 'main.js');
      expect(mainDiff).toBeDefined();
      expect(mainDiff!.delta).toBe(10 * 1024); // 110KB - 100KB
    });
  });
});
