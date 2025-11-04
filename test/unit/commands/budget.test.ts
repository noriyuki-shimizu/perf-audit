import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { budgetCommand } from '../../../src/commands/budget.ts';
import type { BudgetOptions } from '../../../src/types/commands.ts';

// Set test timeout
vi.setConfig({ testTimeout: 1000 });

// Create mock instances
const mockSpinner = {
  text: '',
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
};

const mockConfig = {
  analysis: {
    target: 'client' as const,
    gzip: true,
    ignorePaths: [],
  },
  project: {
    client: {
      outputPath: 'dist/client',
    },
    server: {
      outputPath: 'dist/server',
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
  reports: {
    outputDir: 'reports',
  },
};

// Mock modules
vi.mock('ora', () => ({
  default: vi.fn(() => mockSpinner),
}));

vi.mock('../../../src/core/bundle-analyzer.ts', () => ({
  BundleAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeBundles: vi.fn().mockResolvedValue([
      { name: 'main.js', size: 100000, gzipSize: 30000, path: '/dist/main.js', type: 'client', status: 'ok' },
    ]),
  })),
}));

vi.mock('../../../src/utils/config.ts', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../../src/utils/bundle.ts', () => ({
  applyBudgetsToAllBundles: vi.fn((bundles) => bundles.map((b: never) => ({ ...b, status: 'ok' }))),
  getBudgetStatus: vi.fn().mockReturnValue('ok'),
}));

vi.mock('../../../src/utils/ci-integration.ts', () => ({
  CIIntegration: {
    detectCIEnvironment: vi.fn().mockReturnValue({
      isCI: false,
      branch: 'main',
      commitHash: 'abc123',
    }),
    outputCIAnnotations: vi.fn().mockResolvedValue(undefined),
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

describe('budgetCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(vi.fn() as never);

    // Setup config mock
    const { loadConfig } = await import('../../../src/utils/config.ts');
    vi.mocked(loadConfig).mockResolvedValue(mockConfig);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('should execute budget command successfully', async () => {
    const options: BudgetOptions = {
      format: 'console',
    };

    await budgetCommand(options);

    const { loadConfig } = await import('../../../src/utils/config.ts');
    expect(loadConfig).toHaveBeenCalled();
  });

  it('should handle error gracefully', async () => {
    const options: BudgetOptions = {
      format: 'console',
    };

    const { loadConfig } = await import('../../../src/utils/config.ts');
    vi.mocked(loadConfig).mockRejectedValueOnce(new Error('Test error'));

    await budgetCommand(options);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with correct code for error status', async () => {
    const options: BudgetOptions = {
      format: 'console',
    };

    const { getBudgetStatus } = await import('../../../src/utils/bundle.ts');
    vi.mocked(getBudgetStatus).mockImplementation(() => 'error');

    await budgetCommand(options);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit with correct code for warning status', async () => {
    const options: BudgetOptions = {
      format: 'console',
    };

    const { getBudgetStatus } = await import('../../../src/utils/bundle.ts');
    vi.mocked(getBudgetStatus).mockImplementation(() => 'warning');

    await budgetCommand(options);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
