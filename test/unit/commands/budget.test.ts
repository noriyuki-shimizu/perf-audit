import { beforeEach, describe, expect, it, vi } from 'vitest';
import { budgetCommand } from '../../../src/commands/budget.ts';
import type { BudgetOptions } from '../../../src/types/commands.ts';

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
        total: {
          max: '500KB',
          warning: '400KB',
        },
      },
      server: {
        bundles: [],
      },
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
    warn: vi.fn(),
    error: vi.fn(),
    json: vi.fn(),
  },
}));

vi.mock('../../../src/utils/reporter.ts', () => ({
  ConsoleReporter: vi.fn().mockImplementation(() => ({
    reportBudgetCheck: vi.fn(),
  })),
}));

// BundleAnalyzer static methods mock
const mockBundleAnalyzer = vi.mocked(await import('../../../src/core/bundle-analyzer.ts')).BundleAnalyzer;
(mockBundleAnalyzer as any).applyBudgets = vi.fn().mockImplementation(bundles =>
  bundles.map((b: any) => ({ ...b, status: 'ok' }))
);

describe('budgetCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check budget with console format', async () => {
    const options: BudgetOptions = {
      format: 'console',
    };

    await budgetCommand(options);

    const ConsoleReporter = vi.mocked(await import('../../../src/utils/reporter.ts')).ConsoleReporter;
    expect(ConsoleReporter).toHaveBeenCalled();
  });

  it.each([
    { format: 'json' as const, expectJson: true },
    { format: 'console' as const, expectJson: false },
  ])('should output results in $format format', async ({ format, expectJson }) => {
    const options: BudgetOptions = {
      format,
    };

    await budgetCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    if (expectJson) {
      expect(Logger.json).toHaveBeenCalled();
    } else {
      const ConsoleReporter = vi.mocked(await import('../../../src/utils/reporter.ts')).ConsoleReporter;
      expect(ConsoleReporter).toHaveBeenCalled();
    }
  });

  it('should not use spinner for JSON format', async () => {
    const ora = vi.mocked(await import('ora')).default;

    const options: BudgetOptions = {
      format: 'json',
    };

    await budgetCommand(options);

    // Spinner should not be created for JSON format
    expect(ora).not.toHaveBeenCalled();
  });

  it('should use spinner for console format', async () => {
    const ora = vi.mocked(await import('ora')).default;

    const options: BudgetOptions = {
      format: 'console',
    };

    await budgetCommand(options);

    expect(ora).toHaveBeenCalledWith('Loading configuration...');
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
    } as any);

    const options: BudgetOptions = {
      format: 'console',
    };

    await budgetCommand(options);

    expect(mockBundleAnalyzer).toHaveBeenCalledTimes(2);
  });

  it('should exit with code 1 when budget status is error', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    (mockBundleAnalyzer as any).applyBudgets.mockImplementationOnce((bundles: any[]) =>
      bundles.map((b: any) => ({ ...b, status: 'error' }))
    );

    const options: BudgetOptions = {
      format: 'console',
    };

    await expect(budgetCommand(options)).rejects.toThrow('Process exit');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should exit with code 2 when budget status is warning', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    (mockBundleAnalyzer as any).applyBudgets.mockImplementationOnce((bundles: any[]) =>
      bundles.map((b: any) => ({ ...b, status: 'warning' }))
    );

    const options: BudgetOptions = {
      format: 'console',
    };

    await expect(budgetCommand(options)).rejects.toThrow('Process exit');
    expect(mockExit).toHaveBeenCalledWith(2);

    mockExit.mockRestore();
  });

  it('should handle error and exit with code 1', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    const loadConfig = vi.mocked(await import('../../../src/utils/config.ts')).loadConfig;
    loadConfig.mockRejectedValueOnce(new Error('Config load error'));

    const options: BudgetOptions = {
      format: 'console',
    };

    await expect(budgetCommand(options)).rejects.toThrow('Process exit');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should warn when no bundles are found', async () => {
    const BundleAnalyzer = vi.mocked(await import('../../../src/core/bundle-analyzer.ts')).BundleAnalyzer;
    BundleAnalyzer.mockImplementationOnce(() =>
      ({
        analyzeBundles: vi.fn().mockResolvedValue([]),
      }) as any
    );

    const options: BudgetOptions = {
      format: 'console',
    };

    await budgetCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('Make sure your project has been built'));
  });

  it('should not show warning for JSON format when no bundles found', async () => {
    const BundleAnalyzer = vi.mocked(await import('../../../src/core/bundle-analyzer.ts')).BundleAnalyzer;
    BundleAnalyzer.mockImplementationOnce(() =>
      ({
        analyzeBundles: vi.fn().mockResolvedValue([]),
      }) as any
    );

    const options: BudgetOptions = {
      format: 'json',
    };

    await budgetCommand(options);

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.warn).not.toHaveBeenCalled();
  });

  it('should output CI annotations', async () => {
    const options: BudgetOptions = {
      format: 'console',
    };

    await budgetCommand(options);

    const CIIntegration = vi.mocked(await import('../../../src/utils/ci-integration.ts')).CIIntegration;
    expect(CIIntegration.outputCIAnnotations).toHaveBeenCalled();
  });

  // Temporarily removed: complex test with total budget constraints

  it('should handle invalid config error gracefully', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    const loadConfig = vi.mocked(await import('../../../src/utils/config.ts')).loadConfig;
    loadConfig.mockRejectedValueOnce(new Error('Invalid configuration'));

    const options: BudgetOptions = {
      format: 'json',
    };

    await expect(budgetCommand(options)).rejects.toThrow('Process exit');
    expect(mockExit).toHaveBeenCalledWith(1);

    // Should not show error message for JSON format
    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.error).not.toHaveBeenCalled();

    mockExit.mockRestore();
  });

  it('should show error message for console format on failure', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });

    const loadConfig = vi.mocked(await import('../../../src/utils/config.ts')).loadConfig;
    loadConfig.mockRejectedValueOnce(new Error('Invalid configuration'));

    const options: BudgetOptions = {
      format: 'console',
    };

    await expect(budgetCommand(options)).rejects.toThrow('Process exit');

    const Logger = vi.mocked(await import('../../../src/utils/logger.ts')).Logger;
    expect(Logger.error).toHaveBeenCalledWith('Invalid configuration');

    mockExit.mockRestore();
  });
});
