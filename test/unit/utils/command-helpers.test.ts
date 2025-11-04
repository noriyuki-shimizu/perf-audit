import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditResult } from '../../../src/types/config.ts';
import {
  completeCommand,
  exitBasedOnStatus,
  getCurrentTimestamp,
  handleCommandError,
  initializeCommand,
  initializePluginManager,
  saveBuildData,
} from '../../../src/utils/command-helpers.ts';

vi.setConfig({ testTimeout: 100 });

// Mock ora
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
  text: '',
};

vi.mock('ora', () => ({
  default: vi.fn().mockImplementation(() => mockSpinner),
}));

// Mock database with hoisted variables
const mockDatabaseMethods = vi.hoisted(() => ({
  saveBuild: vi.fn().mockResolvedValue('build-123'),
  close: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/core/database/index.ts', () => ({
  PerformanceDatabaseService: {
    instance: vi.fn().mockResolvedValue(mockDatabaseMethods),
  },
}));

const mockPluginManagerInstance = {
  loadPlugins: vi.fn().mockResolvedValue(undefined),
  executeHook: vi.fn().mockResolvedValue(undefined),
  unloadPlugins: vi.fn().mockResolvedValue(undefined),
};

// Mock plugin system
vi.mock('../../../src/core/plugin-system.ts', () => ({
  PluginManager: class MockPluginManager {
    loadPlugins = mockPluginManagerInstance.loadPlugins;
    executeHook = mockPluginManagerInstance.executeHook;
    unloadPlugins = mockPluginManagerInstance.unloadPlugins;

    constructor(config: any) {
      // constructor logic if needed
    }
  },
}));

// Mock CI integration
vi.mock('../../../src/utils/ci-integration.ts', () => ({
  CIIntegration: {
    detectCIEnvironment: vi.fn().mockReturnValue({
      isCI: false,
      provider: 'unknown',
      branch: 'main',
      commitHash: 'abc123',
    }),
  },
}));

// Mock config
vi.mock('../../../src/utils/config.ts', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    project: {
      client: { outputPath: 'dist/client' },
      server: { outputPath: 'dist/server' },
    },
    budgets: {
      client: { bundles: { main: '100KB', vendor: '200KB', total: '300KB' } },
      server: { bundles: { main: '100KB', vendor: '200KB', total: '300KB' } },
      lighthouse: { performance: 90, accessibility: 90, bestPractices: 90, seo: 90 },
      metrics: { fcp: 1000, lcp: 2000, cls: 0.1, tti: 3000 },
    },
    analysis: {
      target: 'both',
      gzip: true,
      ignorePaths: [],
    },
    reports: {
      outputDir: 'reports',
    },
  }),
}));

const mockConfig = {
  project: {
    client: { outputPath: 'dist/client' },
    server: { outputPath: 'dist/server' },
  },
  budgets: {
    client: { bundles: { main: '100KB', vendor: '200KB', total: '300KB' } },
    server: { bundles: { main: '100KB', vendor: '200KB', total: '300KB' } },
    lighthouse: { performance: 90, accessibility: 90, bestPractices: 90, seo: 90 },
    metrics: { fcp: 1000, lcp: 2000, cls: 0.1, tti: 3000 },
  },
  analysis: {
    target: 'both',
    gzip: true,
    ignorePaths: [],
  },
  reports: {
    outputDir: 'reports',
  },
};

// Mock logger
vi.mock('../../../src/utils/logger.ts', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('command-helpers', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset process.exit mock
    vi.spyOn(process, 'exit').mockImplementation(vi.fn() as unknown as (code?: number) => never);

    // Ensure config mock is working
    const { loadConfig } = await import('../../../src/utils/config.ts');
    vi.mocked(loadConfig).mockResolvedValue(mockConfig);

    // Reset plugin manager instance
    mockPluginManagerInstance.loadPlugins.mockResolvedValue(undefined);
    mockPluginManagerInstance.executeHook.mockResolvedValue(undefined);
    mockPluginManagerInstance.unloadPlugins.mockResolvedValue(undefined);

    // Reset ora mock
    const ora = await import('ora');
    vi.mocked(ora.default).mockImplementation(() => mockSpinner);

    // Reset mockSpinner methods
    mockSpinner.start.mockReturnThis();
    mockSpinner.succeed.mockReturnThis();
    mockSpinner.fail.mockReturnThis();
    mockSpinner.stop.mockReturnThis();

    // Reset plugin manager instance methods
    mockPluginManagerInstance.loadPlugins.mockResolvedValue(undefined);
    mockPluginManagerInstance.executeHook.mockResolvedValue(undefined);
    mockPluginManagerInstance.unloadPlugins.mockResolvedValue(undefined);

    // Reset database mock
    mockDatabaseMethods.saveBuild.mockResolvedValue('build-123');
    mockDatabaseMethods.close.mockResolvedValue(undefined);

    // Re-setup database service mock after clearAllMocks
    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    vi.mocked(PerformanceDatabaseService.instance).mockResolvedValue(mockDatabaseMethods);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentTimestamp', () => {
    it('should return ISO timestamp string', () => {
      const timestamp = getCurrentTimestamp();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp)).toBeInstanceOf(Date);
    });

    it('should return different timestamps when called multiple times', async () => {
      const timestamp1 = getCurrentTimestamp();
      await new Promise(resolve => setTimeout(resolve, 5));
      const timestamp2 = getCurrentTimestamp();

      expect(timestamp1).not.toBe(timestamp2);
    });
  });

  describe('initializeCommand', () => {
    it('should initialize with default message', async () => {
      const { config, spinner } = await initializeCommand();

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(config).toBeDefined();
      expect(config.project).toBeDefined();
      expect(spinner).toBe(mockSpinner);
    });

    it('should initialize with custom message', async () => {
      const customMessage = 'Custom loading message';
      const { config, spinner } = await initializeCommand(customMessage);

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(config).toBeDefined();
      expect(spinner).toBe(mockSpinner);
    });
  });

  describe('initializePluginManager', () => {
    it('should create and load plugin manager', async () => {
      const pluginManager = await initializePluginManager(mockConfig);

      expect(pluginManager.loadPlugins).toHaveBeenCalled();
    });
  });

  describe('saveBuildData', () => {
    it('should handle database errors gracefully', async () => {
      const mockResult: AuditResult = {
        timestamp: '2023-01-01T00:00:00.000Z',
        serverBundles: [],
        clientBundles: [],
        recommendations: [],
        budgetStatus: 'ok',
        analysisType: 'client',
      };

      const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
      vi.mocked(PerformanceDatabaseService.instance).mockRejectedValue(new Error('Database error'));

      const { Logger } = await import('../../../src/utils/logger.ts');

      await saveBuildData(mockResult);

      expect(Logger.warn).toHaveBeenCalledWith('Failed to save build to database');
      expect(Logger.debug).toHaveBeenCalledWith('Database error: Database error');
    });
  });

  describe('handleCommandError', () => {
    it('should handle error with spinner', async () => {
      const error = new Error('Test error');
      const { Logger } = await import('../../../src/utils/logger.ts');

      await handleCommandError(mockSpinner, error);

      expect(mockSpinner.fail).toHaveBeenCalledWith('Operation failed');
      expect(Logger.error).toHaveBeenCalledWith('Test error');
    });

    it('should handle error with custom message', async () => {
      const error = new Error('Test error');
      const customMessage = 'Custom error message';

      await handleCommandError(mockSpinner, error, customMessage);

      expect(mockSpinner.fail).toHaveBeenCalledWith(customMessage);
    });

    it('should execute plugin error hook when config provided', async () => {
      const error = new Error('Test error');

      await handleCommandError(mockSpinner, error, 'Test message', mockConfig);

      expect(mockPluginManagerInstance.executeHook).toHaveBeenCalledWith('onError', {
        error,
        context: 'command',
      });
    });

    it('should handle non-Error objects', async () => {
      const error = 'String error';
      const { Logger } = await import('../../../src/utils/logger.ts');

      await handleCommandError(mockSpinner, error);

      expect(Logger.error).toHaveBeenCalledWith('Unknown error');
    });
  });

  describe('completeCommand', () => {
    it('should complete command successfully', () => {
      completeCommand(mockSpinner, 'Success message');

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Success message');
    });

    it('should handle required message parameter', () => {
      completeCommand(mockSpinner, 'Test message');

      expect(mockSpinner.succeed).toHaveBeenCalledWith('Test message');
    });
  });

  describe('exitBasedOnStatus', () => {
    it('should not exit for ok status', () => {
      const exitSpy = vi.spyOn(process, 'exit');

      exitBasedOnStatus('ok');

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should exit with code 2 for warning status', () => {
      const exitSpy = vi.spyOn(process, 'exit');

      exitBasedOnStatus('warning');

      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it('should exit with code 1 for error status', () => {
      const exitSpy = vi.spyOn(process, 'exit');

      exitBasedOnStatus('error');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
