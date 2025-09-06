import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initCommand } from '../../src/commands/init.ts';

describe('Commands Unit Tests', () => {
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

  describe('initCommand', () => {
    it('should create configuration file and directories', async () => {
      await initCommand();

      expect(fs.existsSync('perf-audit.config.js')).toBe(true);
      expect(fs.existsSync('performance-reports')).toBe(true);
      expect(fs.existsSync('.perf-audit')).toBe(true);
    });

    it('should not overwrite existing configuration', async () => {
      const existingConfig = 'export default { existing: true };';
      fs.writeFileSync('perf-audit.config.js', existingConfig);

      await initCommand();

      const configContent = fs.readFileSync('perf-audit.config.js', 'utf-8');
      expect(configContent).toContain('existing: true');
    });

    it('should return early if config exists', async () => {
      const existingConfig = 'export default { existing: true };';
      fs.writeFileSync('perf-audit.config.js', existingConfig);

      await initCommand();

      // Should not create directories if config already exists
      expect(fs.existsSync('performance-reports')).toBe(false);
      expect(fs.existsSync('.perf-audit')).toBe(false);

      // Config should remain unchanged
      const configContent = fs.readFileSync('perf-audit.config.js', 'utf-8');
      expect(configContent).toContain('existing: true');
    });
  });
});
