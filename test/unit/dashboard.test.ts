import express from 'express';
import fs from 'fs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dashboard command function
vi.mock('../../src/core/database.ts');

describe('Dashboard API', () => {
  let app: express.Application;
  let mockDb: any;
  let tempDir: string;

  beforeEach(() => {
    tempDir = testHelpers.createTempDir();

    // Create Express app similar to dashboard
    app = express();
    app.use(express.json());

    // Mock database
    mockDb = {
      getRecentBuilds: vi.fn(),
      getBuild: vi.fn(),
      getBuildComparison: vi.fn(),
      getTrendData: vi.fn(),
      close: vi.fn(),
    };

    // Setup mock routes (simplified version of actual dashboard routes)
    app.get('/api/builds', (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const builds = mockDb.getRecentBuilds(limit);
        res.json(builds);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch builds' });
      }
    });

    app.get('/api/builds/:id', (req, res) => {
      try {
        const build = mockDb.getBuild(parseInt(req.params.id));
        if (!build) {
          return res.status(404).json({ error: 'Build not found' });
        }
        res.json(build);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch build' });
      }
    });

    app.get('/api/trends', (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const trends = mockDb.getTrendData(days);
        res.json(trends);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trends' });
      }
    });

    app.get('/api/compare/:id1/:id2', (req, res) => {
      try {
        const comparison = mockDb.getBuildComparison(
          parseInt(req.params.id1),
          parseInt(req.params.id2),
        );
        res.json(comparison);
      } catch (error) {
        res.status(500).json({ error: 'Failed to compare builds' });
      }
    });

    app.get('/api/stats', (req, res) => {
      try {
        const builds = mockDb.getRecentBuilds(30);

        if (builds.length === 0) {
          return res.json({
            totalBuilds: 0,
            averageSize: 0,
            lastBuildStatus: 'unknown',
            trendsCount: 0,
            formattedAverageSize: '0 B',
          });
        }

        const totalBuilds = builds.length;
        const totalSizes = builds.map((build: any) =>
          build.bundles.reduce((sum: number, bundle: any) => sum + bundle.size, 0)
        );
        const averageSize = totalSizes.reduce((sum: number, size: number) => sum + size, 0) / totalSizes.length;
        const lastBuild = builds[0];

        // Mock getBuildStatus function
        const hasError = lastBuild.bundles.some((b: any) => b.status === 'error');
        const hasWarning = lastBuild.bundles.some((b: any) => b.status === 'warning');
        const lastBuildStatus = hasError ? 'error' : hasWarning ? 'warning' : 'ok';

        res.json({
          totalBuilds,
          averageSize: Math.round(averageSize),
          lastBuildStatus,
          trendsCount: builds.length,
          formattedAverageSize: `${Math.round(averageSize / 1024)} KB`,
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    });

    app.get('/api/config', (req, res) => {
      res.json({
        budgets: testHelpers.createMockConfig().budgets,
        analysis: testHelpers.createMockConfig().analysis,
        reports: testHelpers.createMockConfig().reports,
      });
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('GET /api/builds', () => {
    it('should return recent builds', async () => {
      const mockBuilds = [
        {
          id: 1,
          timestamp: '2023-01-01T00:00:00.000Z',
          branch: 'main',
          bundles: [testHelpers.createMockBundle('main.js', 100 * 1024)],
          recommendations: [],
        },
      ];

      mockDb.getRecentBuilds.mockReturnValue(mockBuilds);

      const response = await request(app)
        .get('/api/builds')
        .expect(200);

      expect(response.body).toEqual(mockBuilds);
      expect(mockDb.getRecentBuilds).toHaveBeenCalledWith(50);
    });

    it('should respect limit parameter', async () => {
      mockDb.getRecentBuilds.mockReturnValue([]);

      await request(app)
        .get('/api/builds?limit=10')
        .expect(200);

      expect(mockDb.getRecentBuilds).toHaveBeenCalledWith(10);
    });

    it('should handle database errors', async () => {
      mockDb.getRecentBuilds.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/builds')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch builds' });
    });
  });

  describe('GET /api/builds/:id', () => {
    it('should return build by ID', async () => {
      const mockBuild = {
        id: 1,
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [testHelpers.createMockBundle('main.js', 100 * 1024)],
        recommendations: [],
      };

      mockDb.getBuild.mockReturnValue(mockBuild);

      const response = await request(app)
        .get('/api/builds/1')
        .expect(200);

      expect(response.body).toEqual(mockBuild);
      expect(mockDb.getBuild).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent build', async () => {
      mockDb.getBuild.mockReturnValue(null);

      const response = await request(app)
        .get('/api/builds/999')
        .expect(404);

      expect(response.body).toEqual({ error: 'Build not found' });
    });
  });

  describe('GET /api/trends', () => {
    it('should return trend data', async () => {
      const mockTrends = [
        {
          date: '2023-01-01',
          totalSize: 100 * 1024,
          gzipSize: 30 * 1024,
          performanceScore: 85,
        },
      ];

      mockDb.getTrendData.mockReturnValue(mockTrends);

      const response = await request(app)
        .get('/api/trends')
        .expect(200);

      expect(response.body).toEqual(mockTrends);
      expect(mockDb.getTrendData).toHaveBeenCalledWith(30);
    });

    it('should respect days parameter', async () => {
      mockDb.getTrendData.mockReturnValue([]);

      await request(app)
        .get('/api/trends?days=7')
        .expect(200);

      expect(mockDb.getTrendData).toHaveBeenCalledWith(7);
    });
  });

  describe('GET /api/compare/:id1/:id2', () => {
    it('should return build comparison', async () => {
      const mockComparison = {
        build1: { id: 1 },
        build2: { id: 2 },
        bundleDiff: [
          {
            name: 'main.js',
            oldSize: 100 * 1024,
            newSize: 110 * 1024,
            delta: 10 * 1024,
          },
        ],
        metricDiff: [],
      };

      mockDb.getBuildComparison.mockReturnValue(mockComparison);

      const response = await request(app)
        .get('/api/compare/1/2')
        .expect(200);

      expect(response.body).toEqual(mockComparison);
      expect(mockDb.getBuildComparison).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('GET /api/stats', () => {
    it('should return dashboard stats', async () => {
      const mockBuilds = [
        {
          id: 1,
          bundles: [
            testHelpers.createMockBundle('main.js', 100 * 1024),
            testHelpers.createMockBundle('vendor.js', 50 * 1024),
          ],
        },
        {
          id: 2,
          bundles: [
            testHelpers.createMockBundle('main.js', 110 * 1024),
            testHelpers.createMockBundle('vendor.js', 55 * 1024),
          ],
        },
      ];

      mockDb.getRecentBuilds.mockReturnValue(mockBuilds);

      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalBuilds', 2);
      expect(response.body).toHaveProperty('averageSize');
      expect(response.body).toHaveProperty('lastBuildStatus');
      expect(response.body).toHaveProperty('trendsCount', 2);
      expect(response.body).toHaveProperty('formattedAverageSize');
    });

    it('should handle empty builds', async () => {
      mockDb.getRecentBuilds.mockReturnValue([]);

      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toEqual({
        totalBuilds: 0,
        averageSize: 0,
        lastBuildStatus: 'unknown',
        trendsCount: 0,
        formattedAverageSize: '0 B',
      });
    });
  });

  describe('GET /api/config', () => {
    it('should return configuration', async () => {
      const response = await request(app)
        .get('/api/config')
        .expect(200);

      expect(response.body).toHaveProperty('budgets');
      expect(response.body).toHaveProperty('analysis');
      expect(response.body).toHaveProperty('reports');
    });
  });
});
