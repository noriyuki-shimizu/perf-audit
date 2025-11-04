import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeCommand } from '../../../src/commands/analyze.ts';
import type { AnalyzeOptions } from '../../../src/types/commands.ts';

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

const mockPluginManager = {
  loadPlugins: vi.fn().mockResolvedValue(undefined),
  unloadPlugins: vi.fn().mockResolvedValue(undefined),
  executeHook: vi.fn().mockResolvedValue(undefined),
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
      bundles: [],
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
      { name: 'main.js', size: 100000, gzipSize: 30000, path: '/dist/main.js', type: 'client' },
    ]),
  })),
}));

vi.mock('../../../src/utils/command-helpers.ts', () => ({
  initializeCommand: vi.fn(),
  initializePluginManager: vi.fn(),
  saveBuildData: vi.fn(),
  completeCommand: vi.fn(),
  handleCommandError: vi.fn(),
}));

vi.mock('../../../src/utils/bundle.ts', () => ({
  applyBudgetsToAllBundles: vi.fn((bundles) => bundles.map((b: never) => ({ ...b, status: 'ok' }))),
  createAuditResult: vi.fn((bundles, config, recommendations) => ({
    bundles,
    recommendations,
    timestamp: Date.now(),
  })),
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

describe('analyzeCommand', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Setup command-helpers mocks
    const { initializeCommand, initializePluginManager, saveBuildData } = await import(
      '../../../src/utils/command-helpers.ts'
    );
    vi.mocked(initializeCommand).mockResolvedValue({
      config: mockConfig,
      spinner: mockSpinner,
    });
    vi.mocked(initializePluginManager).mockResolvedValue(mockPluginManager);
    vi.mocked(saveBuildData).mockResolvedValue(undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it('should execute analyze command successfully', async () => {
    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    await analyzeCommand(options);

    const { initializeCommand } = await import('../../../src/utils/command-helpers.ts');
    expect(initializeCommand).toHaveBeenCalled();
  });

  it('should handle error gracefully', async () => {
    const options: AnalyzeOptions = {
      format: 'console',
      details: false,
    };

    const { initializeCommand } = await import('../../../src/utils/command-helpers.ts');
    vi.mocked(initializeCommand).mockRejectedValueOnce(new Error('Test error'));

    await expect(analyzeCommand(options)).rejects.toThrow('Test error');
  });
});
