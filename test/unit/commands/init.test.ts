import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initCommand } from '../../../src/commands/init.ts';

vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('fs');
vi.mock('path');
vi.mock('../../../src/utils/config.ts', () => ({
  generateConfigFile: vi.fn(),
}));
vi.mock('../../../src/utils/logger.ts', () => ({
  Logger: {
    section: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    complete: vi.fn(),
    nextSteps: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

describe('initCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'exit').mockImplementation(vi.fn() as never);
    vi.spyOn(process, 'cwd').mockReturnValue('/project');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize successfully with all steps', async () => {
    const { generateConfigFile } = await import('../../../src/utils/config.ts');
    const { Logger } = await import('../../../src/utils/logger.ts');

    // Setup mocks
    mockPath.join
      .mockReturnValueOnce('/project/perf-audit.config.js') // config path
      .mockReturnValueOnce('/project/.gitignore') // gitignore path
      .mockReturnValueOnce('/project/performance-reports') // reports dir
      .mockReturnValueOnce('/project/.perf-audit'); // data dir

    mockFs.existsSync
      .mockReturnValueOnce(false) // config doesn't exist
      .mockReturnValueOnce(true) // gitignore exists
      .mockReturnValueOnce(false) // reports dir doesn't exist
      .mockReturnValueOnce(false); // data dir doesn't exist

    mockFs.readFileSync.mockReturnValue('node_modules/\n*.log');
    mockFs.appendFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => {});

    await initCommand();

    expect(Logger.section).toHaveBeenCalledWith('Initializing Performance Audit CLI...');
    expect(generateConfigFile).toHaveBeenCalledWith('/project/perf-audit.config.js');
    expect(Logger.success).toHaveBeenCalledWith('Configuration file created successfully');
    expect(mockFs.appendFileSync).toHaveBeenCalledWith(
      '/project/.gitignore',
      '\n# Performance Audit data\n.perf-audit/\nperformance-reports/\n',
    );
    expect(Logger.success).toHaveBeenCalledWith('Added entries to .gitignore');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/project/performance-reports', { recursive: true });
    expect(Logger.success).toHaveBeenCalledWith('Created reports directory');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith('/project/.perf-audit', { recursive: true });
    expect(Logger.success).toHaveBeenCalledWith('Created data directory');
    expect(Logger.complete).toHaveBeenCalledWith('Performance Audit CLI initialized successfully!');
    expect(Logger.nextSteps).toHaveBeenCalledWith('Next steps:', [
      'Edit perf-audit.config.js to match your project setup',
      'Run perf-audit analyze to start analyzing your bundle',
      'Run perf-audit budget to check performance budgets',
    ]);
  });

  it('should warn and return early if config already exists', async () => {
    const { Logger } = await import('../../../src/utils/logger.ts');

    mockPath.join.mockReturnValueOnce('/project/perf-audit.config.js');
    mockFs.existsSync.mockReturnValueOnce(true); // config exists

    await initCommand();

    expect(Logger.warn).toHaveBeenCalledWith('Configuration file already exists: /project/perf-audit.config.js');
    expect(Logger.section).toHaveBeenCalledWith('Initializing Performance Audit CLI...');
  });

  it('should skip gitignore update if entries already exist', async () => {
    const { generateConfigFile } = await import('../../../src/utils/config.ts');
    const { Logger } = await import('../../../src/utils/logger.ts');

    mockPath.join
      .mockReturnValueOnce('/project/perf-audit.config.js')
      .mockReturnValueOnce('/project/.gitignore')
      .mockReturnValueOnce('/project/performance-reports')
      .mockReturnValueOnce('/project/.perf-audit');

    mockFs.existsSync
      .mockReturnValueOnce(false) // config doesn't exist
      .mockReturnValueOnce(true) // gitignore exists
      .mockReturnValueOnce(false) // reports dir doesn't exist
      .mockReturnValueOnce(false); // data dir doesn't exist

    mockFs.readFileSync.mockReturnValue('node_modules/\n.perf-audit/\nperformance-reports/');
    mockFs.mkdirSync.mockImplementation(() => {});

    await initCommand();

    expect(generateConfigFile).toHaveBeenCalledWith('/project/perf-audit.config.js');
    expect(mockFs.appendFileSync).not.toHaveBeenCalled();
    expect(Logger.success).not.toHaveBeenCalledWith('Added entries to .gitignore');
  });

  it('should skip gitignore update if .gitignore does not exist', async () => {
    const { generateConfigFile } = await import('../../../src/utils/config.ts');

    mockPath.join
      .mockReturnValueOnce('/project/perf-audit.config.js')
      .mockReturnValueOnce('/project/.gitignore')
      .mockReturnValueOnce('/project/performance-reports')
      .mockReturnValueOnce('/project/.perf-audit');

    mockFs.existsSync
      .mockReturnValueOnce(false) // config doesn't exist
      .mockReturnValueOnce(false) // gitignore doesn't exist
      .mockReturnValueOnce(false) // reports dir doesn't exist
      .mockReturnValueOnce(false); // data dir doesn't exist

    mockFs.mkdirSync.mockImplementation(() => {});

    await initCommand();

    expect(generateConfigFile).toHaveBeenCalledWith('/project/perf-audit.config.js');
    expect(mockFs.readFileSync).not.toHaveBeenCalled();
    expect(mockFs.appendFileSync).not.toHaveBeenCalled();
  });

  it('should skip directory creation if directories already exist', async () => {
    const { generateConfigFile } = await import('../../../src/utils/config.ts');
    const { Logger } = await import('../../../src/utils/logger.ts');

    mockPath.join
      .mockReturnValueOnce('/project/perf-audit.config.js')
      .mockReturnValueOnce('/project/.gitignore')
      .mockReturnValueOnce('/project/performance-reports')
      .mockReturnValueOnce('/project/.perf-audit');

    mockFs.existsSync
      .mockReturnValueOnce(false) // config doesn't exist
      .mockReturnValueOnce(false) // gitignore doesn't exist
      .mockReturnValueOnce(true) // reports dir exists
      .mockReturnValueOnce(true); // data dir exists

    await initCommand();

    expect(generateConfigFile).toHaveBeenCalledWith('/project/perf-audit.config.js');
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(Logger.success).not.toHaveBeenCalledWith('Created reports directory');
    expect(Logger.success).not.toHaveBeenCalledWith('Created data directory');
  });

  it('should handle errors and exit with code 1', async () => {
    const { generateConfigFile } = await import('../../../src/utils/config.ts');
    const { Logger } = await import('../../../src/utils/logger.ts');
    const exitSpy = vi.spyOn(process, 'exit');

    mockPath.join.mockReturnValueOnce('/project/perf-audit.config.js');
    mockFs.existsSync.mockReturnValueOnce(false);
    vi.mocked(generateConfigFile).mockImplementation(() => {
      throw new Error('Failed to create config');
    });

    await initCommand();

    expect(Logger.error).toHaveBeenCalledWith('Failed to initialize', {
      error: 'Failed to create config',
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should handle non-Error objects in catch block', async () => {
    const { generateConfigFile } = await import('../../../src/utils/config.ts');
    const { Logger } = await import('../../../src/utils/logger.ts');
    const exitSpy = vi.spyOn(process, 'exit');

    mockPath.join.mockReturnValueOnce('/project/perf-audit.config.js');
    mockFs.existsSync.mockReturnValueOnce(false);
    vi.mocked(generateConfigFile).mockImplementation(() => {
      throw 'String error';
    });

    await initCommand();

    expect(Logger.error).toHaveBeenCalledWith('Failed to initialize', {
      error: 'Unknown error',
    });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
