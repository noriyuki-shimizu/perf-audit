import Database from 'better-sqlite3';
import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceDatabase } from '../../../src/core/database.ts';
import type { BundleInfo } from '../../../src/types/config.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('better-sqlite3');
vi.mock('fs');

const mockFs = vi.mocked(fs);
const mockDatabase = vi.mocked(Database);

describe('PerformanceDatabase', () => {
  let mockDb: {
    exec: vi.Mock;
    close: vi.Mock;
    prepare: vi.Mock;
    transaction: vi.Mock;
  };
  let mockPrepare: vi.Mock;
  let mockExec: vi.Mock;
  let mockClose: vi.Mock;
  let mockTransaction: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExec = vi.fn();
    mockClose = vi.fn();
    mockPrepare = vi.fn();
    mockTransaction = vi.fn();

    mockDb = {
      exec: mockExec,
      close: mockClose,
      prepare: mockPrepare,
      transaction: mockTransaction,
    };

    mockDatabase.mockImplementation(() => mockDb);
    mockFs.existsSync.mockReturnValue(true);
  });

  describe('constructor', () => {
    it('should create database with default path', () => {
      new PerformanceDatabase();

      expect(mockDatabase).toHaveBeenCalledWith(expect.stringContaining('.perf-audit/performance.db'));
      expect(mockExec).toHaveBeenCalled();
    });

    it('should create database with custom path', () => {
      const customPath = 'custom/db.sqlite';

      new PerformanceDatabase(customPath);

      expect(mockDatabase).toHaveBeenCalledWith(expect.stringContaining(customPath));
    });

    it('should create directory if not exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});

      new PerformanceDatabase();

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should initialize database schema', () => {
      new PerformanceDatabase();

      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS builds'));
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS bundles'));
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS metrics'));
      expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS recommendations'));
    });
  });

  describe('saveBuild', () => {
    it('should save build data successfully', () => {
      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 123 });
      const mockStatement = { run: mockRun };

      mockPrepare.mockReturnValue(mockStatement);
      mockTransaction.mockImplementation(fn => fn);

      const db = new PerformanceDatabase();

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

      const result = db.saveBuild(buildData);

      expect(result).toBe(123);
      expect(mockPrepare).toHaveBeenCalledTimes(4); // build, bundle, metric, recommendation
    });

    it('should save build with minimal data', () => {
      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 456 });
      const mockStatement = { run: mockRun };

      mockPrepare.mockReturnValue(mockStatement);
      mockTransaction.mockImplementation(fn => fn);

      const db = new PerformanceDatabase();

      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [],
        recommendations: [],
      };

      const result = db.saveBuild(buildData);

      expect(result).toBe(456);
    });

    it('should handle bundles without optional properties', () => {
      const mockRun = vi.fn().mockReturnValue({ lastInsertRowid: 789 });
      const mockStatement = { run: mockRun };

      mockPrepare.mockReturnValue(mockStatement);
      mockTransaction.mockImplementation(fn => fn);

      const db = new PerformanceDatabase();

      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [
          {
            name: 'main.js',
            size: 100000,
            status: 'ok' as const,
          },
        ] as BundleInfo[],
        recommendations: [],
      };

      const result = db.saveBuild(buildData);

      expect(result).toBe(789);
      expect(mockRun).toHaveBeenCalledWith(
        789,
        'main.js',
        100000,
        null, // gzipSize
        null, // delta
        'ok',
        null, // type
      );
    });
  });

  describe('getTrendData', () => {
    it('should return trend data for specified days', () => {
      const mockAll = vi.fn().mockReturnValue([
        {
          date: '2023-01-01',
          totalSize: 200000,
          gzipSize: 60000,
          performanceScore: 85,
          fcp: 1500,
          lcp: 2200,
          cls: 0.05,
          tti: 3000,
        },
      ]);
      const mockStatement = { all: mockAll };

      mockPrepare.mockReturnValue(mockStatement);

      const db = new PerformanceDatabase();
      const result = db.getTrendData(7);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('-7 days'));
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        date: '2023-01-01',
        totalSize: 200000,
        gzipSize: 60000,
        performanceScore: 85,
        fcp: 1500,
        lcp: 2200,
        cls: 0.05,
        tti: 3000,
      });
    });

    it('should use default 30 days', () => {
      const mockAll = vi.fn().mockReturnValue([]);
      const mockStatement = { all: mockAll };

      mockPrepare.mockReturnValue(mockStatement);

      const db = new PerformanceDatabase();
      db.getTrendData();

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('-30 days'));
    });
  });

  describe('getRecentBuilds', () => {
    it('should return recent builds with bundles and recommendations', () => {
      const mockAllBuilds = vi.fn().mockReturnValue([
        {
          id: 1,
          timestamp: '2023-01-01T00:00:00.000Z',
          branch: 'main',
          commitHash: 'abc123',
          url: 'https://example.com',
          device: 'desktop',
        },
      ]);

      const mockAllBundles = vi.fn().mockReturnValue([
        {
          name: 'main.js',
          size: 100000,
          gzipSize: 30000,
          delta: null,
          status: 'ok',
          type: 'client',
        },
      ]);

      const mockAllRecommendations = vi.fn().mockReturnValue([
        { message: 'Optimize images' },
      ]);

      mockPrepare
        .mockReturnValueOnce({ all: mockAllBuilds })
        .mockReturnValueOnce({ all: mockAllBundles })
        .mockReturnValueOnce({ all: mockAllRecommendations });

      const db = new PerformanceDatabase();
      const result = db.getRecentBuilds(5, 'DESC');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 1,
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
            delta: null,
            status: 'ok',
            type: 'client',
          },
        ],
        recommendations: ['Optimize images'],
      });
    });

    it.each([
      { orderBy: 'ASC' as const, expectedOrder: 'ASC' },
      { orderBy: 'DESC' as const, expectedOrder: 'DESC' },
    ])('should order results by $orderBy', ({ orderBy, expectedOrder }) => {
      const mockAll = vi.fn().mockReturnValue([]);
      mockPrepare.mockReturnValue({ all: mockAll });

      const db = new PerformanceDatabase();
      db.getRecentBuilds(10, orderBy);

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining(`ORDER BY timestamp ${expectedOrder}`),
      );
    });
  });

  describe('getBuild', () => {
    it('should return build by id', () => {
      const mockGet = vi.fn().mockReturnValue({
        id: 1,
        timestamp: '2023-01-01T00:00:00.000Z',
        branch: 'main',
      });

      const mockAll = vi.fn().mockReturnValue([]);

      mockPrepare
        .mockReturnValueOnce({ get: mockGet })
        .mockReturnValueOnce({ all: mockAll })
        .mockReturnValueOnce({ all: mockAll });

      const db = new PerformanceDatabase();
      const result = db.getBuild(1);

      expect(result).toEqual({
        id: 1,
        timestamp: '2023-01-01T00:00:00.000Z',
        branch: 'main',
        bundles: [],
        recommendations: [],
      });
    });

    it('should return null for non-existent build', () => {
      const mockGet = vi.fn().mockReturnValue(undefined);
      mockPrepare.mockReturnValue({ get: mockGet });

      const db = new PerformanceDatabase();
      const result = db.getBuild(999);

      expect(result).toBeNull();
    });
  });

  describe('getBuildComparison', () => {
    it('should compare two builds', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({
          id: 1,
          bundles: 'main.js:100000:30000',
          metrics: 'performance_score:85',
        })
        .mockReturnValueOnce({
          id: 2,
          bundles: 'main.js:120000:35000',
          metrics: 'performance_score:82',
        });

      mockPrepare.mockReturnValue({ get: mockGet });

      const db = new PerformanceDatabase();
      const result = db.getBuildComparison(1, 2);

      expect(result.bundleDiff).toHaveLength(1);
      expect(result.bundleDiff[0]).toEqual({
        name: 'main.js',
        oldSize: 100000,
        newSize: 120000,
        delta: 20000,
        oldGzipSize: 30000,
        newGzipSize: 35000,
        gzipDelta: 5000,
      });

      expect(result.metricDiff).toHaveLength(1);
      expect(result.metricDiff[0]).toEqual({
        name: 'performance_score',
        oldValue: 85,
        newValue: 82,
        delta: -3,
      });
    });

    it('should handle empty comparison data', () => {
      const mockGet = vi.fn()
        .mockReturnValueOnce({ id: 1, bundles: '', metrics: '' })
        .mockReturnValueOnce({ id: 2, bundles: '', metrics: '' });

      mockPrepare.mockReturnValue({ get: mockGet });

      const db = new PerformanceDatabase();
      const result = db.getBuildComparison(1, 2);

      expect(result.bundleDiff).toHaveLength(0);
      expect(result.metricDiff).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should delete old builds', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 5 });
      mockPrepare.mockReturnValue({ run: mockRun });

      const db = new PerformanceDatabase();
      const result = db.cleanup(30);

      expect(result).toBe(5);
      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('-30 days'),
      );
    });

    it('should return 0 when no builds deleted', () => {
      const mockRun = vi.fn().mockReturnValue({ changes: 0 });
      mockPrepare.mockReturnValue({ run: mockRun });

      const db = new PerformanceDatabase();
      const result = db.cleanup(7);

      expect(result).toBe(0);
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      const db = new PerformanceDatabase();
      db.close();

      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database initialization errors', () => {
      mockDatabase.mockImplementation(() => {
        throw new Error('Database initialization failed');
      });

      expect(() => new PerformanceDatabase()).toThrow('Database initialization failed');
    });

    it('should handle transaction errors in saveBuild', () => {
      mockTransaction.mockImplementation(() => {
        throw new Error('Transaction failed');
      });

      const db = new PerformanceDatabase();
      const buildData = {
        timestamp: '2023-01-01T00:00:00.000Z',
        bundles: [],
        recommendations: [],
      };

      expect(() => db.saveBuild(buildData)).toThrow('Transaction failed');
    });
  });
});
