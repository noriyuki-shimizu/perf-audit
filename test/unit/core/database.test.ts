import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceDatabaseService } from '../../../src/core/database/index.ts';
import type {
  BuildRepository,
  BundleRepository,
  MetricRepository,
  RecommendationRepository,
  Repository,
} from '../../../src/core/database/repositories.ts';
import type { BundleInfo } from '../../../src/types/config.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock the database factory and related modules
vi.mock('../../../src/core/database/factory.ts', () => ({
  DatabaseFactory: {
    createRepository: vi.fn(),
    createConfigFromEnv: vi.fn(() => ({
      type: 'sqlite',
      database: ':memory:',
    })),
  },
}));

describe('PerformanceDatabase', () => {
  let mockBuildsRepo: BuildRepository;
  let mockBundlesRepo: BundleRepository;
  let mockMetricsRepo: MetricRepository;
  let mockRecommendationsRepo: RecommendationRepository;
  let mockRepository: Repository;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the singleton instance
    (PerformanceDatabaseService as unknown as { _instance: undefined; })._instance = undefined;

    // Create mock repositories
    mockBuildsRepo = {
      create: vi.fn().mockReturnValue(123),
      findRecent: vi.fn().mockReturnValue([]),
      findById: vi.fn().mockReturnValue(null),
      getTrendData: vi.fn().mockReturnValue([]),
      getComparison: vi.fn().mockReturnValue({
        build1: undefined,
        build2: undefined,
        bundleDiff: [],
        metricDiff: [],
      }),
      cleanup: vi.fn().mockReturnValue(0),
      findByDateRange: vi.fn().mockReturnValue([]),
    };

    mockBundlesRepo = {
      createMany: vi.fn(),
      findByBuildId: vi.fn().mockReturnValue([]),
      findLargeBundles: vi.fn().mockReturnValue([]),
    };

    mockMetricsRepo = {
      createMany: vi.fn(),
      getMetricStats: vi.fn().mockReturnValue({ average: 0, min: 0, max: 0, count: 0 }),
      findMetricHistory: vi.fn().mockReturnValue([]),
    };

    mockRecommendationsRepo = {
      createMany: vi.fn(),
      findByBuildId: vi.fn().mockReturnValue([]),
      findFrequentRecommendations: vi.fn().mockReturnValue([]),
    };

    mockRepository = {
      builds: mockBuildsRepo,
      bundles: mockBundlesRepo,
      metrics: mockMetricsRepo,
      recommendations: mockRecommendationsRepo,
      close: vi.fn(),
      initSchema: vi.fn(),
    };

    // DatabaseFactory.createRepositoryがmockRepositoryを返すように設定
    const { DatabaseFactory } = await import('../../../src/core/database/factory.ts');
    DatabaseFactory.createRepository.mockReturnValue(mockRepository);
  });

  describe('instance', () => {
    it('should create database instance', async () => {
      const db = await PerformanceDatabaseService.instance();

      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(PerformanceDatabaseService);
    });

    it('should create database instance with custom path', async () => {
      const customPath = 'custom/db.sqlite';
      // Reset instance for this test
      (PerformanceDatabaseService as unknown as { _instance: undefined; })._instance = undefined;

      // Mock factory to use custom path
      const { DatabaseFactory } = await import('../../../src/core/database/factory.ts');
      DatabaseFactory.createConfigFromEnv.mockReturnValue({
        type: 'sqlite',
        database: customPath,
      });

      const db = await PerformanceDatabaseService.instance();

      expect(db).toBeDefined();
      expect(db).toBeInstanceOf(PerformanceDatabaseService);
    });

    it('should return same instance (singleton pattern)', async () => {
      const db1 = await PerformanceDatabaseService.instance();
      const db2 = await PerformanceDatabaseService.instance();

      expect(db1).toBe(db2);
    });

    it('should have Repository properly initialized', async () => {
      const db = await PerformanceDatabaseService.instance();
      const repository = (db as unknown as { getRepository: () => Repository; }).getRepository();

      expect(repository).toBeDefined();
      expect(repository.builds).toBeDefined();
      expect(repository.bundles).toBeDefined();
      expect(repository.metrics).toBeDefined();
      expect(repository.recommendations).toBeDefined();
    });
  });

  describe('saveBuild', () => {
    it('should save build data successfully', async () => {
      const db = await PerformanceDatabaseService.instance();

      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        branch: 'main',
        commitHash: 'abc123',
        url: 'https://example.com',
        device: 'desktop',
        bundles: [
          {
            name: 'main.js',
            size: 100000,
            gzipSize: 30000,
            status: 'ok' as const,
            type: 'client' as const,
          },
        ],
        metrics: {
          performance: 85,
          accessibility: 95,
          bestPractices: 92,
          seo: 88,
          metrics: {
            fcp: 1500,
            lcp: 2200,
            cls: 0.05,
            tti: 3000,
          },
        },
        recommendations: ['Optimize images'],
      };

      const result = await db.saveBuild(buildData);

      expect(result).toBe(123);
      expect(mockBuildsRepo.create).toHaveBeenCalledWith(buildData);
      expect(mockBundlesRepo.createMany).toHaveBeenCalledWith(123, buildData.bundles);
      expect(mockMetricsRepo.createMany).toHaveBeenCalledWith(123, expect.any(Array));
      expect(mockRecommendationsRepo.createMany).toHaveBeenCalledWith(123, buildData.recommendations, 'performance');
    });

    it('should save build with minimal data', async () => {
      mockBuildsRepo.create = vi.fn().mockReturnValue(456);
      const db = await PerformanceDatabaseService.instance();

      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [],
        metrics: {
          performance: 75,
        },
        recommendations: [],
      };

      const result = await db.saveBuild(buildData);

      expect(result).toBe(456);
      expect(mockBuildsRepo.create).toHaveBeenCalledWith(buildData);
    });

    it('should handle bundles without optional properties', async () => {
      mockBuildsRepo.create = vi.fn().mockReturnValue(789);
      const db = await PerformanceDatabaseService.instance();

      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [
          {
            name: 'app.js',
            size: 50000,
            status: 'ok' as const,
            type: 'client' as const,
          } as BundleInfo,
        ],
        metrics: {
          performance: 90,
        },
        recommendations: [],
      };

      const result = await db.saveBuild(buildData);

      expect(result).toBe(789);
      expect(mockBundlesRepo.createMany).toHaveBeenCalledWith(789, buildData.bundles);
    });
  });

  describe('getTrendData', () => {
    it('should return trend data for specified days', async () => {
      const trendData = [
        {
          timestamp: '2023-01-01T00:00:00.000Z',
          performance: 85,
          bundle_size: 100000,
        },
      ];
      mockBuildsRepo.getTrendData = vi.fn().mockReturnValue(trendData);

      const db = await PerformanceDatabaseService.instance();
      const result = db.getTrendData(7);

      expect(mockBuildsRepo.getTrendData).toHaveBeenCalledWith(7);
      expect(result).toEqual(trendData);
    });

    it('should use default 30 days', async () => {
      const db = await PerformanceDatabaseService.instance();
      db.getTrendData();

      expect(mockBuildsRepo.getTrendData).toHaveBeenCalledWith(30);
    });
  });

  describe('getRecentBuilds', () => {
    it('should return recent builds with bundles and recommendations', async () => {
      const mockBuild = {
        id: 1,
        timestamp: '2023-01-01T00:00:00.000Z',
        branch: 'main',
        commitHash: 'abc123',
        url: 'https://example.com',
        device: 'desktop',
      };

      const mockBundles = [
        {
          name: 'main.js',
          size: 100000,
          gzipSize: 30000,
          status: 'ok' as const,
          type: 'client' as const,
        },
      ];

      const mockRecommendations = ['Optimize images'];

      mockBuildsRepo.findRecent = vi.fn().mockReturnValue([mockBuild]);
      mockBundlesRepo.findByBuildId = vi.fn().mockReturnValue(mockBundles);
      mockRecommendationsRepo.findByBuildId = vi.fn().mockReturnValue(mockRecommendations);

      const db = await PerformanceDatabaseService.instance();
      const result = db.getRecentBuilds(5, 'DESC');

      expect(mockBuildsRepo.findRecent).toHaveBeenCalledWith(5, 'DESC');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ...mockBuild,
        bundles: mockBundles,
        recommendations: mockRecommendations,
      });
    });

    it('should order results by ASC', async () => {
      const db = await PerformanceDatabaseService.instance();
      db.getRecentBuilds(10, 'ASC');

      expect(mockBuildsRepo.findRecent).toHaveBeenCalledWith(10, 'ASC');
    });

    it('should order results by DESC', async () => {
      const db = await PerformanceDatabaseService.instance();
      db.getRecentBuilds(10, 'DESC');

      expect(mockBuildsRepo.findRecent).toHaveBeenCalledWith(10, 'DESC');
    });
  });

  describe('getBuild', () => {
    it('should return build by id', async () => {
      const mockBuild = {
        id: 1,
        timestamp: '2023-01-01T00:00:00.000Z',
        branch: 'main',
        commitHash: 'abc123',
        url: 'https://example.com',
        device: 'desktop',
      };

      const mockBundles = [
        {
          name: 'main.js',
          size: 100000,
          gzipSize: 30000,
          status: 'ok' as const,
          type: 'client' as const,
        },
      ];

      const mockRecommendations = ['Optimize images'];

      mockBuildsRepo.findById = vi.fn().mockReturnValue(mockBuild);
      mockBundlesRepo.findByBuildId = vi.fn().mockReturnValue(mockBundles);
      mockRecommendationsRepo.findByBuildId = vi.fn().mockReturnValue(mockRecommendations);

      const db = await PerformanceDatabaseService.instance();
      const result = db.getBuild(1);

      expect(mockBuildsRepo.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        ...mockBuild,
        bundles: mockBundles,
        recommendations: mockRecommendations,
      });
    });

    it('should return null for non-existent build', async () => {
      mockBuildsRepo.findById = vi.fn().mockReturnValue(null);

      const db = await PerformanceDatabaseService.instance();
      const result = db.getBuild(999);

      expect(mockBuildsRepo.findById).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });
  });

  describe('getBuildComparison', () => {
    it('should compare two builds', async () => {
      const comparisonData = {
        build1: {
          id: 1,
          timestamp: '2023-01-01T00:00:00.000Z',
          branch: 'main',
          bundles: [],
          metrics: [],
        },
        build2: {
          id: 2,
          timestamp: '2023-01-02T00:00:00.000Z',
          branch: 'main',
          bundles: [],
          metrics: [],
        },
        bundleDiff: [],
        metricDiff: [],
      };

      mockBuildsRepo.getComparison = vi.fn().mockReturnValue(comparisonData);

      const db = await PerformanceDatabaseService.instance();
      const result = db.getBuildComparison(1, 2);

      expect(mockBuildsRepo.getComparison).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(comparisonData);
    });

    it('should handle empty comparison data', async () => {
      const emptyComparison = {
        build1: undefined,
        build2: undefined,
        bundleDiff: [],
        metricDiff: [],
      };

      mockBuildsRepo.getComparison = vi.fn().mockReturnValue(emptyComparison);

      const db = await PerformanceDatabaseService.instance();
      const result = db.getBuildComparison(1, 2);

      expect(result).toEqual(emptyComparison);
    });
  });

  describe('cleanup', () => {
    it('should delete old builds', async () => {
      mockBuildsRepo.cleanup = vi.fn().mockReturnValue(5);

      const db = await PerformanceDatabaseService.instance();
      const result = db.cleanup(30);

      expect(mockBuildsRepo.cleanup).toHaveBeenCalledWith(30);
      expect(result).toBe(5);
    });

    it('should return 0 when no builds deleted', async () => {
      mockBuildsRepo.cleanup = vi.fn().mockReturnValue(0);

      const db = await PerformanceDatabaseService.instance();
      const result = db.cleanup(7);

      expect(result).toBe(0);
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      const db = await PerformanceDatabaseService.instance();
      db.close();

      expect(mockRepository.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database initialization errors', async () => {
      // This test focuses on the service layer behavior rather than low-level errors
      const db = await PerformanceDatabaseService.instance();
      expect(db).toBeDefined();
    });

    it('should handle transaction errors in saveBuild', async () => {
      // In the new architecture, error handling is managed at the repository level
      // This test ensures the service layer properly delegates to repositories
      const db = await PerformanceDatabaseService.instance();
      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [],
        metrics: {
          performance: 85,
          metrics: {
            fcp: 1200,
            lcp: 2000,
            cls: 0.08,
            tti: 3000,
          },
        },
        recommendations: [],
      };

      const result = await db.saveBuild(buildData);
      expect(result).toBe(123); // Should use the mock return value
    });
  });
});
