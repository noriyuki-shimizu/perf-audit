import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG_FILE } from '../../../src/constants/index.ts';
import { generateConfigFile, loadConfig } from '../../../src/utils/config.ts';

vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('fs');
vi.mock('path');
vi.mock('../../../src/utils/logger.ts', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

// Mock path.join and path.resolve
const mockPathJoin = vi.fn();
const mockPathResolve = vi.fn();
mockPath.join = mockPathJoin;
mockPath.resolve = mockPathResolve;

// Mock process.cwd
const originalCwd = process.cwd;
const mockCwd = vi.fn();

describe('config utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathJoin.mockImplementation((...args) => args.join('/'));
    mockPathResolve.mockImplementation((...args) => args.join('/'));
    mockCwd.mockReturnValue('/test/project');
    process.cwd = mockCwd;
    delete process.env.PERF_AUDIT_CONFIG_FILE;
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  describe('loadConfig', () => {
    it('should return default config when no file exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await loadConfig();

      expect(mockFs.existsSync).toHaveBeenCalledWith('/test/project/perf-audit.config.js');
      expect(result).toBeDefined();
      expect(result.project.client.outputPath).toBe('./dist');
    });

    it('should use custom path when provided', async () => {
      const customPath = './custom-config.js';
      mockFs.existsSync.mockReturnValue(false);

      const result = await loadConfig(customPath);

      expect(mockFs.existsSync).toHaveBeenCalledWith(customPath);
      expect(result).toBeDefined();
      expect(result.project.client.outputPath).toBe('./dist');
    });

    it('should handle errors gracefully and return default config', async () => {
      mockFs.existsSync.mockReturnValue(true);
      // Make existsSync throw an error to trigger catch block
      mockFs.existsSync.mockImplementationOnce(() => {
        throw new Error('File access error');
      });

      const result = await loadConfig();

      expect(result).toBeDefined();
      expect(result.project.client.outputPath).toBe('./dist');
    });
  });

  describe('generateConfigFile', () => {
    it('should generate config file at default path', async () => {
      const { Logger } = await import('../../../src/utils/logger.ts');
      mockFs.writeFileSync.mockImplementation(() => {});

      generateConfigFile();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        DEFAULT_CONFIG_FILE,
        expect.stringContaining('module.exports'),
      );
      expect(Logger.success).toHaveBeenCalledWith(`Configuration file created: ${DEFAULT_CONFIG_FILE}`);
    });

    it('should generate config file at custom path', async () => {
      const { Logger } = await import('../../../src/utils/logger.ts');
      const customPath = './custom-perf.config.js';
      mockFs.writeFileSync.mockImplementation(() => {});

      generateConfigFile(customPath);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        customPath,
        expect.stringContaining('module.exports'),
      );
      expect(Logger.success).toHaveBeenCalledWith(`Configuration file created: ${customPath}`);
    });

    it('should write valid config content', async () => {
      const { Logger } = await import('../../../src/utils/logger.ts');
      let writtenContent = '';
      mockFs.writeFileSync.mockImplementation((_, content) => {
        writtenContent = content as string;
      });

      generateConfigFile();

      expect(writtenContent).toContain('module.exports');
      expect(writtenContent).toContain('project:');
      expect(writtenContent).toContain('budgets:');
      expect(writtenContent).toContain('analysis:');
      expect(writtenContent).toContain('reports:');
      expect(Logger.success).toHaveBeenCalled();
    });
  });
});
