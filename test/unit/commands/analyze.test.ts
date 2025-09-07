import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeCommand } from '../../../src/commands/analyze.ts';
import type { AnalyzeOptions } from '../../../src/types/commands.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

vi.mock('../../../src/core/bundle-analyzer.ts', () => ({
  BundleAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeBundles: vi.fn().mockResolvedValue([
      { name: 'main.js', size: 100000, gzipSize: 30000, path: '/dist/main.js' },
    ]),
  })),
}));

vi.mock('../../../src/core/database.ts', () => ({
  PerformanceDatabase: vi.fn().mockImplementation(() => ({
    saveBuild: vi.fn().mockReturnValue('build-123'),
    close: vi.fn(),
  })),
}));

vi.mock('../../../src/core/plugin-system.ts', () => ({
  PluginManager: vi.fn().mockImplementation(() => ({
    loadPlugins: vi.fn().mockResolvedValue(undefined),
    unloadPlugins: vi.fn().mockResolvedValue(undefined),
    executeHook: vi.fn().mockResolvedValue(undefined),
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
        bundles: [
          {
            name: '*.js',
            maxSize: '200KB',
            warning: '150KB',
          },
        ],
      },
      server: {
        bundles: [],
      },
    },
    reports: {
      outputDir: 'reports',
    },
  }),
}));

vi.mock('../../../src/utils/ci-integration.ts', () => ({
  CIIntegration: {
    detectCIEnvironment: vi.fn().mockReturnValue({
      isCI: false,
      branch: 'main',
      commitHash: 'abc123',
    }),
    outputCIAnnotations: vi.fn(),
  },
}));

vi.mock('../../../src/utils/logger.ts', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    json: vi.fn(),
  },
}));

vi.mock('../../../src/utils/report-generator.ts', () => ({
  ReportGenerator: {
    generateJsonReport: vi.fn(),
    generateHtmlReport: vi.fn(),
  },
}));

vi.mock('../../../src/utils/reporter.ts', () => ({
  ConsoleReporter: vi.fn().mockImplementation(() => ({
    reportBundleAnalysis: vi.fn(),
  })),
}));

// BundleAnalyzer static methods mock
const mockBundleAnalyzer = vi.mocked(await import('../../../src/core/bundle-analyzer.ts')).BundleAnalyzer;
(mockBundleAnalyzer as any).applyBudgets = vi.fn().mockImplementation(bundles =>
  bundles.map((b: any) => ({ ...b, status: 'ok' }))
);
(mockBundleAnalyzer as any).calculateTotalSize = vi.fn().mockReturnValue({
  totalSize: 100000,
  totalGzipSize: 30000,
});

describe('analyzeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should analyze client bundles with console format', async () => {
    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await analyzeCommand(options);

    expect(mockBundleAnalyzer).toHaveBeenCalledWith({
      outputPath: 'dist',
      gzip: true,
      ignorePaths: [],
    });
  });

  it.each([
    { format: 'json' as const },
    { format: 'html' as const },
    { format: 'console' as const },
  ])('should output results in $format format', async ({ format }) => {
    const options: AnalyzeOptions = {
      format,
      details: false,
    };

    await analyzeCommand(options);

    if (format === 'json') {
      const ReportGenerator = vi.mocked(await import('../../../src/utils/report-generator.ts')).ReportGenerator;
      expect(ReportGenerator.generateJsonReport).toHaveBeenCalled();
    } else if (format === 'html') {
      const ReportGenerator = vi.mocked(await import('../../../src/utils/report-generator.ts')).ReportGenerator;
      expect(ReportGenerator.generateHtmlReport).toHaveBeenCalled();
    } else {
      const ConsoleReporter = vi.mocked(await import('../../../src/utils/reporter.ts')).ConsoleReporter;
      expect(ConsoleReporter).toHaveBeenCalled();
    }
  });

  it('should analyze both client and server bundles when target is both', async () => {
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
          bundles: [],
        },
        server: {
          bundles: [],
        },
      },
      reports: {
        outputDir: 'reports',
      },
    } as any);

    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await analyzeCommand(options);

    expect(mockBundleAnalyzer).toHaveBeenCalledTimes(2);
  });

  it('should handle error and exit process', async () => {
    const loadConfig = vi.mocked(await import('../../../src/utils/config.ts')).loadConfig;
    loadConfig.mockRejectedValueOnce(new Error('Config load error'));

    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await expect(analyzeCommand(options)).rejects.toThrow('Config load error');
  });

  it('should warn when no bundles are found', async () => {
    const { BundleAnalyzer } = await import('../../../src/core/bundle-analyzer.ts');
    const mockAnalyzeBundles = vi.fn().mockResolvedValue([]);
    vi.mocked(BundleAnalyzer).mockImplementationOnce(() =>
      ({
        analyzeBundles: mockAnalyzeBundles,
      }) as any
    );

    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await analyzeCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('Make sure your project has been built'));
  });

  it('should save build to database', async () => {
    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await analyzeCommand(options);

    const { PerformanceDatabase } = await import('../../../src/core/database.ts');
    const mockInstance = vi.mocked(PerformanceDatabase).mock.results[0]?.value;
    expect(mockInstance.saveBuild).toHaveBeenCalled();
    expect(mockInstance.close).toHaveBeenCalled();
  });

  it('should execute plugin hooks in correct order', async () => {
    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await analyzeCommand(options);

    const { PluginManager } = await import('../../../src/core/plugin-system.ts');
    const mockInstance = vi.mocked(PluginManager).mock.results[0]?.value;

    const executedHooks = mockInstance.executeHook.mock.calls.map((call: any) => call[0]);
    expect(executedHooks).toContain('beforeAnalysis');
    expect(executedHooks).toContain('beforeBundleAnalysis');
    expect(executedHooks).toContain('afterBundleAnalysis');
    expect(executedHooks).toContain('afterAnalysis');
    expect(executedHooks).toContain('beforeReport');
    expect(executedHooks).toContain('afterReport');
  });

  it('should handle database save failure gracefully', async () => {
    const { PerformanceDatabase } = await import('../../../src/core/database.ts');
    vi.mocked(PerformanceDatabase).mockImplementationOnce(() =>
      ({
        saveBuild: vi.fn().mockImplementation(() => {
          throw new Error('Database error');
        }),
        close: vi.fn(),
      }) as any
    );

    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await analyzeCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.warn).toHaveBeenCalledWith('Failed to save build to database');
  });

  it('should pass details option to console reporter', async () => {
    const options: AnalyzeOptions = {
      format: 'console',
      details: true,
    };

    await analyzeCommand(options);

    const { ConsoleReporter } = await import('../../../src/utils/reporter.ts');
    const mockInstance = vi.mocked(ConsoleReporter).mock.results[0]?.value;
    expect(mockInstance.reportBundleAnalysis).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      true,
    );
  });
});
