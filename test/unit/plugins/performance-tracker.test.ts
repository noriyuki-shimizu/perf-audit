import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performanceTrackerPlugin } from '../../../src/plugins/performance-tracker.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('fs');
vi.mock('../../../src/utils/size.ts', () => ({
  formatSizeString: vi.fn((size: number) => `${Math.round(size / 1024)}KB`),
}));

const mockFs = vi.mocked(fs);

describe('performanceTrackerPlugin', () => {
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = {
      store: new Map(),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockImplementation(() => {});
    mockFs.writeFileSync.mockImplementation(() => {});
  });

  describe('plugin metadata', () => {
    it('should have correct plugin information', () => {
      expect(performanceTrackerPlugin.name).toBe('performance-tracker');
      expect(performanceTrackerPlugin.version).toBe('1.0.0');
      expect(performanceTrackerPlugin.description).toBe('Tracks performance trends and detects regressions');
    });
  });

  describe('install hook', () => {
    it('should create tracking directory if not exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      await performanceTrackerPlugin.install!(mockContext);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.perf-audit/tracking'),
        { recursive: true },
      );
      expect(mockContext.store.get('trackingDir')).toContain('.perf-audit/tracking');
    });

    it('should not create directory if already exists', async () => {
      mockFs.existsSync.mockReturnValue(true);

      await performanceTrackerPlugin.install!(mockContext);

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('afterAnalysis hook', () => {
    beforeEach(() => {
      mockContext.store.set('trackingDir', '/test/tracking');
    });

    it('should handle missing data gracefully', async () => {
      await performanceTrackerPlugin.hooks!.afterAnalysis!(mockContext, undefined);

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});
