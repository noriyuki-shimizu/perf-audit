import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('CLI Integration', () => {
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

  const runCLI = (
    args: string[],
    timeout = 10000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null; }> => {
    return new Promise((resolve, reject) => {
      const cliPath = path.resolve(originalCwd, 'dist/bin/cli.js');
      const child = spawn('node', [cliPath, ...args], {
        cwd: tempDir,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        resolve({ stdout, stderr, exitCode: code });
      });

      child.on('error', reject);

      // Timeout protection
      setTimeout(() => {
        child.kill();
        reject(new Error('CLI command timeout'));
      }, timeout);
    });
  };

  describe('init command', () => {
    it('should create configuration file', async () => {
      const { stdout, exitCode } = await runCLI(['init']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('initialized successfully');
      expect(fs.existsSync(path.join(tempDir, 'perf-audit.config.js'))).toBe(true);
    });

    it('should create required directories', async () => {
      const { exitCode } = await runCLI(['init']);

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, 'performance-reports'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.perf-audit'))).toBe(true);
    });

    it('should not overwrite existing config', async () => {
      const existingConfig = 'export default { existing: true };';
      fs.writeFileSync(path.join(tempDir, 'perf-audit.config.js'), existingConfig);

      const { stdout, exitCode } = await runCLI(['init']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('already exists');

      const configContent = fs.readFileSync(path.join(tempDir, 'perf-audit.config.js'), 'utf-8');
      expect(configContent).toContain('existing: true');
    });
  });

  describe('analyze command', () => {
    beforeEach(async () => {
      // Setup test project
      await runCLI(['init']);

      // Create test bundles
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(path.join(distDir, 'main.js'), 'console.log("main");'.repeat(100));
      fs.writeFileSync(path.join(distDir, 'vendor.js'), 'console.log("vendor");'.repeat(50));
    });

    it('should analyze bundles successfully', async () => {
      const { stdout, exitCode } = await runCLI(['analyze']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Bundle Analysis');
      expect(stdout).toContain('main.js');
      expect(stdout).toContain('vendor.js');
      expect(stdout).toContain('Total:');
    });

    it('should generate JSON report', async () => {
      const { stdout, exitCode } = await runCLI(['analyze', '--format', 'json']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('JSON report saved');

      const reportFiles = fs.readdirSync(path.join(tempDir, 'performance-reports'));
      const jsonReport = reportFiles.find(f => f.endsWith('.json'));
      expect(jsonReport).toBeDefined();

      if (jsonReport) {
        const reportContent = fs.readFileSync(path.join(tempDir, 'performance-reports', jsonReport), 'utf-8');
        const report = JSON.parse(reportContent);
        expect(report).toHaveProperty('bundles');
        expect(report).toHaveProperty('meta');
        expect(report.meta).toHaveProperty('timestamp');
        expect(report.bundles).toHaveLength(2);
      }
    });

    it('should generate HTML report', async () => {
      const { stdout, exitCode } = await runCLI(['analyze', '--format', 'html']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('HTML report saved');

      const reportFiles = fs.readdirSync(path.join(tempDir, 'performance-reports'));
      const htmlReport = reportFiles.find(f => f.endsWith('.html'));
      expect(htmlReport).toBeDefined();

      if (htmlReport) {
        const reportContent = fs.readFileSync(path.join(tempDir, 'performance-reports', htmlReport), 'utf-8');
        expect(reportContent).toContain('html lang="en"');
        expect(reportContent).toContain('Performance Audit Report');
      }
    });

    it('should handle missing bundles gracefully', async () => {
      // Remove dist directory
      fs.rmSync(path.join(tempDir, 'dist'), { recursive: true });

      const { stdout, exitCode } = await runCLI(['analyze']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Make sure your project has been built');
    });
  });

  describe('budget command', () => {
    beforeEach(async () => {
      await runCLI(['init']);

      // Create bundles that exceed budget
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(distDir, { recursive: true });

      // Create large bundle (200KB) that should exceed default budget
      const largeBundleContent = 'a'.repeat(200 * 1024);
      fs.writeFileSync(path.join(distDir, 'main.js'), largeBundleContent);
    });

    it('should check budget constraints', async () => {
      const { stdout, exitCode } = await runCLI(['budget']);

      expect(exitCode).toBe(1); // Should fail due to budget violation
      expect(stdout).toContain('Budget');
    });

    it('should output JSON format', async () => {
      const { stdout, exitCode } = await runCLI(['budget', '--format', 'json']);

      expect(exitCode).toBe(1);

      // Try to parse the entire stdout as JSON first
      let result;
      try {
        result = JSON.parse(stdout.trim());
      } catch {
        // Fallback to finding JSON line
        const lines = stdout.trim().split('\n');
        const jsonLine = lines.find(line => line.trim().startsWith('{'));
        expect(jsonLine).toBeDefined();
        result = JSON.parse(jsonLine!);
      }

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('violations');
      expect(result.passed).toBe(false);
    });

    it('should pass with small bundles', async () => {
      // Replace with small bundle
      fs.writeFileSync(path.join(tempDir, 'dist', 'main.js'), 'small content');

      const { stdout, exitCode } = await runCLI(['budget']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('passed');
    });
  });

  describe('history command', () => {
    beforeEach(async () => {
      await runCLI(['init']);

      // Create test bundles and run analysis to populate history
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(path.join(distDir, 'main.js'), 'content');

      await runCLI(['analyze']);
    });

    it('should show performance history', async () => {
      const { stdout, exitCode } = await runCLI(['history']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Performance History');
      expect(stdout).toContain('Recent Builds');
    });

    it('should respect days parameter', async () => {
      const { stdout, exitCode } = await runCLI(['history', '--days', '7']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Last 7 days');
    });

    it('should output JSON format', async () => {
      const { stdout, exitCode } = await runCLI(['history', '--format', 'json']);

      expect(exitCode).toBe(0);

      const lines = stdout.trim().split('\n');
      const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));
      expect(jsonLine).toBeDefined();
    });
  });

  describe('help command', () => {
    it('should show help information', async () => {
      const { stdout, exitCode } = await runCLI(['--help']);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('init');
      expect(stdout).toContain('analyze');
      expect(stdout).toContain('budget');
      expect(stdout).toContain('history');
      expect(stdout).toContain('watch');
      expect(stdout).toContain('dashboard');
    });

    it('should show version information', async () => {
      const { stdout, exitCode } = await runCLI(['--version']);

      expect(exitCode).toBe(0);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('error handling', () => {
    it('should handle invalid command gracefully', async () => {
      const { stdout, stderr, exitCode } = await runCLI(['invalid-command']);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('unknown command');
    });

    it('should handle invalid options gracefully', async () => {
      const { exitCode } = await runCLI(['analyze', '--invalid-option']);

      // Commander.js should handle this gracefully
      expect(exitCode).not.toBe(null);
    });
  });
});
