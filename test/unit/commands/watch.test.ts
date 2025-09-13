import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WatchOptions } from '../../../src/types/commands.ts';
import { BundleInfo } from '../../../src/types/config.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn().mockReturnValue({
      on: vi.fn(),
      close: vi.fn(),
    }),
  },
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  })),
}));

vi.mock('../../../src/core/bundle-analyzer.ts', () => ({
  BundleAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeBundles: vi.fn().mockResolvedValue([
      { name: 'main.js', size: 100000, gzipSize: 30000, path: '/dist/main.js' },
    ]),
  })),
}));

vi.mock('../../../src/core/database/index.ts', () => ({
  PerformanceDatabaseService: {
    instance: vi.fn().mockReturnValue({
      saveBuild: vi.fn().mockReturnValue('build-123'),
      close: vi.fn(),
    }),
  },
}));

vi.mock('../../../src/core/notification-service.ts', () => ({
  NotificationService: vi.fn().mockImplementation(() => ({
    sendPerformanceAlert: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../src/utils/config.ts', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    analysis: {
      target: 'client',
      gzip: true,
      ignorePaths: [],
    },
    project: {
      client: {
        outputPath: 'dist',
      },
      server: {
        outputPath: 'dist-server',
      },
    },
    budgets: {
      client: {
        bundles: [],
      },
      server: {
        bundles: [],
      },
    },
  }),
}));

vi.mock('../../../src/utils/logger.ts', () => ({
  Logger: {
    section: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../src/utils/size.ts', () => ({
  formatSizeString: vi.fn((size: number) => `${Math.round(size / 1024)}KB`),
}));

// BundleAnalyzer static methods mock
const mockBundleAnalyzer = vi.mocked(await import('../../../src/core/bundle-analyzer.ts')).BundleAnalyzer;
mockBundleAnalyzer.applyBudgets = vi.fn().mockImplementation((bundles: BundleInfo[]) =>
  bundles.map(b => ({ ...b, status: 'ok' }))
);

describe('watchCommand', () => {
  let watchCommand: typeof import('../../../src/commands/watch.ts').watchCommand;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Mock process.on and process.exit
    vi.spyOn(process, 'on').mockImplementation(
      (): NodeJS.Process => {
        // Don't actually call the callback in tests
        return process;
      },
    );
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    // Dynamic import to ensure fresh module
    watchCommand = (await import('../../../src/commands/watch.ts')).watchCommand;
  });

  it('should start watch mode with default options', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.section).toHaveBeenCalledWith('Starting watch mode...');
    expect(Logger.success).toHaveBeenCalledWith('Watch mode active. Press Ctrl+C to stop.');
    expect(Logger.info).toHaveBeenCalledWith('Waiting for changes...');
  });

  it('should run initial analysis', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.info).toHaveBeenCalledWith('Running initial analysis...');
    expect(Logger.success).toHaveBeenCalledWith('Initial analysis completed');
  });

  it('should setup file watcher with correct paths', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const chokidar = vi.mocked(await import('chokidar')).default;
    expect(chokidar.watch).toHaveBeenCalledWith(['dist', 'dist-server'], {
      ignored: /node_modules/,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });
  });

  it('should create notification service when notify option is true', async () => {
    const options: WatchOptions = {
      notify: true,
    };

    await watchCommand(options);

    const NotificationService =
      vi.mocked(await import('../../../src/core/notification-service.ts')).NotificationService;
    expect(NotificationService).toHaveBeenCalled();
  });

  it('should not create notification service when notify option is false', async () => {
    const options: WatchOptions = {
      notify: false,
    };

    await watchCommand(options);

    const NotificationService =
      vi.mocked(await import('../../../src/core/notification-service.ts')).NotificationService;
    expect(NotificationService).not.toHaveBeenCalled();
  });

  it('should handle initial analysis failure gracefully', async () => {
    const BundleAnalyzer = vi.mocked(await import('../../../src/core/bundle-analyzer.ts')).BundleAnalyzer;
    BundleAnalyzer.mockImplementationOnce(() => {
      throw new Error('Initial analysis error');
    });

    const options: WatchOptions = {};

    await watchCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.warn).toHaveBeenCalledWith('Initial analysis failed, will retry on changes');
  });

  it('should setup SIGINT handler for graceful shutdown', async () => {
    const mockOn = vi.spyOn(process, 'on');

    const options: WatchOptions = {};

    await watchCommand(options);

    expect(mockOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('should handle configuration loading error', async () => {
    const loadConfig = vi.mocked(await import('../../../src/utils/config.ts')).loadConfig;
    loadConfig.mockRejectedValueOnce(new Error('Config error'));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    const options: WatchOptions = {};

    await expect(watchCommand(options)).rejects.toThrow('Process exit');

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.error).toHaveBeenCalledWith('Failed to start watch mode: Config error');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should use custom interval when provided', async () => {
    const options: WatchOptions = {
      interval: 2000,
    };

    await watchCommand(options);

    // Can't easily test the internal interval behavior, but we can verify the command runs
    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.success).toHaveBeenCalledWith('Watch mode active. Press Ctrl+C to stop.');
  });

  it('should run in silent mode when specified', async () => {
    const options: WatchOptions = {
      silent: true,
    };

    await watchCommand(options);

    // In silent mode, initial analysis should still run but with different logging
    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.success).toHaveBeenCalledWith('Initial analysis completed');
  });

  it('should handle both client and server analysis', async () => {
    const loadConfig = vi.mocked(await import('../../../src/utils/config.ts')).loadConfig;
    loadConfig.mockResolvedValueOnce({
      analysis: {
        target: 'both',
        gzip: true,
        ignorePaths: [],
      },
      project: {
        client: {
          outputPath: 'dist',
        },
        server: {
          outputPath: 'dist-server',
        },
      },
      budgets: {
        client: {
          bundles: {},
        },
        server: {
          bundles: {},
        },
        lighthouse: {
          performance: { min: 0, warning: 0 },
          accessibility: { min: 0 },
          seo: { min: 0 },
          bestPractices: { min: 0 },
        },
        metrics: {
          fcp: { max: 0, warning: 0 },
          lcp: { max: 0, warning: 0 },
          cls: { max: 0, warning: 0 },
          tti: { max: 0, warning: 0 },
        },
      },
      reports: {
        formats: ['json', 'html'],
        outputDir: 'reports',
      },
    });

    const options: WatchOptions = {};

    await watchCommand(options);

    expect(mockBundleAnalyzer).toHaveBeenCalledTimes(2);
  });

  it('should save analysis results to database', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    const mockInstance = vi.mocked(PerformanceDatabaseService.instance)();
    expect(mockInstance.saveBuild).toHaveBeenCalledWith({
      timestamp: expect.any(String),
      bundles: expect.any(Array),
      recommendations: expect.any(Array),
    });
  });

  it('should setup error handler for watcher', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const chokidar = vi.mocked(await import('chokidar')).default;
    const mockWatcher = chokidar.watch.mock.results[0]?.value;
    expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should setup change handler for watcher', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const chokidar = vi.mocked(await import('chokidar')).default;
    const mockWatcher = chokidar.watch.mock.results[0]?.value;
    expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should filter out node_modules from watch', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const chokidar = vi.mocked(await import('chokidar')).default;
    expect(chokidar.watch).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        ignored: /node_modules/,
      }),
    );
  });

  it('should debug log watched paths', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.debug).toHaveBeenCalledWith('Watching paths: dist, dist-server');
  });

  it('should handle empty bundle analysis result', async () => {
    const BundleAnalyzer = vi.mocked(await import('../../../src/core/bundle-analyzer.ts')).BundleAnalyzer;
    BundleAnalyzer.mockImplementationOnce(() => ({
      analyzeBundles: vi.fn().mockResolvedValue([]),
    }));

    const options: WatchOptions = {};

    await watchCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.warn).toHaveBeenCalledWith('Initial analysis failed, will retry on changes');
  });

  it('should create database instance', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    expect(PerformanceDatabaseService.instance).toHaveBeenCalled();
  });

  it('should set up watcher with correct options', async () => {
    const options: WatchOptions = {};

    await watchCommand(options);

    const chokidar = vi.mocked(await import('chokidar')).default;
    expect(chokidar.watch).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: expect.objectContaining({
          stabilityThreshold: 500,
          pollInterval: 100,
        }),
      }),
    );
  });
});
