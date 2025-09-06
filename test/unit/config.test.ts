import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateConfigFile, loadConfig } from '../../src/utils/config.ts';

describe('Config', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = testHelpers.createTempDir();
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should load custom config file', async () => {
      const configPath = path.join(tempDir, 'perf-audit.config.js');
      const customConfig = `export default {
        project: {
          type: 'vite',
          configPath: './vite.config.js',
          outputPath: './build'
        },
        budgets: {
          bundles: {
            main: { max: '200KB', warning: '150KB' }
          }
        }
      };`;

      fs.writeFileSync(configPath, customConfig);

      const config = await loadConfig();

      expect(config.project.type).toBe('vite');
      expect(config.project.outputPath).toBe('./build');
      expect(config.budgets.bundles.main.max).toBe('200KB');
    });

    it('should return default config when no file exists', async () => {
      const config = await loadConfig();

      expect(config.project.type).toBe('webpack');
      expect(config.project.outputPath).toBe('./dist');
      expect(config.budgets.bundles.main).toBeDefined();
    });

    it('should merge custom config with defaults', async () => {
      const configPath = path.join(tempDir, 'perf-audit.config.js');
      const partialConfig = `export default {
        project: {
          type: 'rollup'
        }
      };`;

      fs.writeFileSync(configPath, partialConfig);

      const config = await loadConfig();

      // Custom value
      expect(config.project.type).toBe('rollup');
      // Default values should still exist
      expect(config.project.outputPath).toBe('./dist');
      expect(config.budgets.bundles.main).toBeDefined();
    });

    it('should load config from custom path', async () => {
      const customPath = path.join(tempDir, 'custom.config.js');
      const customConfig = `export default {
        project: {
          type: 'esbuild'
        }
      };`;

      fs.writeFileSync(customPath, customConfig);

      const config = await loadConfig(customPath);

      expect(config.project.type).toBe('esbuild');
    });

    it('should handle invalid config file gracefully', async () => {
      const configPath = path.join(tempDir, 'perf-audit.config.js');
      fs.writeFileSync(configPath, 'invalid javascript syntax {');

      const config = await loadConfig();

      // Should fall back to default config
      expect(config.project.type).toBe('webpack');
    });
  });

  describe('generateConfigFile', () => {
    it('should generate valid config file', () => {
      const configPath = path.join(tempDir, 'generated.config.js');

      generateConfigFile(configPath);

      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, 'utf-8');
      expect(content).toContain('export default');
      expect(content).toContain('project:');
      expect(content).toContain('budgets:');
      expect(content).toContain('plugins:');
    });

    it('should create file at default path if no path provided', () => {
      generateConfigFile();

      const defaultPath = path.join(tempDir, 'perf-audit.config.js');
      expect(fs.existsSync(defaultPath)).toBe(true);
    });

    it('should include all required configuration sections', () => {
      const configPath = path.join(tempDir, 'test.config.js');
      generateConfigFile(configPath);

      const content = fs.readFileSync(configPath, 'utf-8');

      // Check for all main sections
      expect(content).toContain('project:');
      expect(content).toContain('budgets:');
      expect(content).toContain('analysis:');
      expect(content).toContain('reports:');
      expect(content).toContain('notifications:');
      expect(content).toContain('plugins:');
    });
  });
});
