import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerformanceDatabase } from '../../../src/core/database.ts';
import type { AuditResult } from '../../../src/types/config.ts';
import { CIIntegration } from '../../../src/utils/ci-integration.ts';

vi.setConfig({ testTimeout: 100 });

vi.mock('../../../src/core/database.ts');

const mockDatabase = vi.mocked(PerformanceDatabase);

describe('CIIntegration', () => {
  const mockAuditResult: AuditResult = {
    timestamp: '2023-01-01T00:00:00.000Z',
    analysisType: 'client',
    bundles: [
      {
        name: 'main.js',
        size: 100000,
        gzipSize: 30000,
        status: 'ok',
        type: 'client',
      },
      {
        name: 'vendor.js',
        size: 200000,
        gzipSize: 60000,
        status: 'warning',
        type: 'client',
      },
    ],
    budgetStatus: 'warning',
    recommendations: ['Consider code splitting', 'Optimize images'],
    lighthouse: {
      performance: 85,
      accessibility: 90,
      bestPractices: 88,
      seo: 92,
      metrics: {
        fcp: 1200,
        lcp: 2000,
        cls: 0.08,
        tti: 3000,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.JENKINS_URL;
    delete process.env.CI;
    delete process.env.GITHUB_REF_NAME;
    delete process.env.GITHUB_SHA;
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_EVENT_NUMBER;
    delete process.env.GITHUB_RUN_NUMBER;
    vi.restoreAllMocks();
  });

  describe('detectCIEnvironment', () => {
    it('should detect GitHub Actions environment', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF_NAME = 'main';
      process.env.GITHUB_SHA = 'abc123';
      process.env.GITHUB_RUN_NUMBER = '42';

      const context = CIIntegration.detectCIEnvironment();

      expect(context).toEqual({
        isCI: true,
        provider: 'github',
        branch: 'main',
        commitHash: 'abc123',
        pullRequestId: undefined,
        buildNumber: '42',
      });
    });

    it('should detect GitHub Actions pull request', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF_NAME = 'feature-branch';
      process.env.GITHUB_SHA = 'def456';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      process.env.GITHUB_EVENT_NUMBER = '123';
      process.env.GITHUB_RUN_NUMBER = '43';

      const context = CIIntegration.detectCIEnvironment();

      expect(context.pullRequestId).toBe('123');
    });

    it('should detect GitLab CI environment', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_COMMIT_REF_NAME = 'develop';
      process.env.CI_COMMIT_SHA = 'xyz789';
      process.env.CI_MERGE_REQUEST_IID = '456';
      process.env.CI_PIPELINE_ID = '789';

      const context = CIIntegration.detectCIEnvironment();

      expect(context).toEqual({
        isCI: true,
        provider: 'gitlab',
        branch: 'develop',
        commitHash: 'xyz789',
        pullRequestId: '456',
        buildNumber: '789',
      });
    });

    it('should detect Jenkins environment', () => {
      process.env.JENKINS_URL = 'http://jenkins.example.com';
      process.env.GIT_BRANCH = 'master';
      process.env.GIT_COMMIT = 'jenkins123';
      process.env.BUILD_NUMBER = '100';

      const context = CIIntegration.detectCIEnvironment();

      expect(context).toEqual({
        isCI: true,
        provider: 'jenkins',
        branch: 'master',
        commitHash: 'jenkins123',
        buildNumber: '100',
      });
    });

    it('should detect generic CI environment', () => {
      process.env.CI = 'true';
      process.env.BRANCH = 'feature';
      process.env.COMMIT_SHA = 'generic123';

      const context = CIIntegration.detectCIEnvironment();

      expect(context).toEqual({
        isCI: true,
        provider: 'unknown',
        branch: 'feature',
        commitHash: 'generic123',
      });
    });

    it('should detect non-CI environment', () => {
      const context = CIIntegration.detectCIEnvironment();

      expect(context).toEqual({
        isCI: false,
        provider: 'unknown',
      });
    });
  });

  describe('generateGitHubActionsSummary', () => {
    it('should include bundle analysis table', () => {
      const summary = CIIntegration.generateGitHubActionsSummary(mockAuditResult);

      expect(summary).toContain('## 📦 Bundle Analysis');
      expect(summary).toContain('| Bundle | Size | Gzipped | Status |');
      expect(summary).toContain('| `main.js` | 97.7KB | 29.3KB | ✅ ok |');
      expect(summary).toContain('| `vendor.js` | 195.3KB | 58.6KB | ⚠️ warning |');
    });

    it('should include Lighthouse scores when available', () => {
      const summary = CIIntegration.generateGitHubActionsSummary(mockAuditResult);

      expect(summary).toContain('## 📊 Lighthouse Scores');
      expect(summary).toContain('| Performance | 85/100 |');
      expect(summary).toContain('| Accessibility | 90/100 |');
      expect(summary).toContain('| Best Practices | 88/100 |');
      expect(summary).toContain('| SEO | 92/100 |');
    });

    it('should include Core Web Vitals when available', () => {
      const summary = CIIntegration.generateGitHubActionsSummary(mockAuditResult);

      expect(summary).toContain('## 🚀 Core Web Vitals');
      expect(summary).toContain('| First Contentful Paint | 1200ms |');
      expect(summary).toContain('| Largest Contentful Paint | 2000ms |');
      expect(summary).toContain('| Cumulative Layout Shift | 0.08 |');
      expect(summary).toContain('| Time to Interactive | 3000ms |');
    });

    it('should include recommendations', () => {
      const summary = CIIntegration.generateGitHubActionsSummary(mockAuditResult);

      expect(summary).toContain('## 💡 Recommendations');
      expect(summary).toContain('- Consider code splitting');
      expect(summary).toContain('- Optimize images');
    });

    it('should handle result without Lighthouse data', () => {
      const resultWithoutLighthouse = {
        ...mockAuditResult,
        lighthouse: undefined,
      };

      const summary = CIIntegration.generateGitHubActionsSummary(resultWithoutLighthouse);

      expect(summary).not.toContain('## 📊 Lighthouse Scores');
      expect(summary).not.toContain('## 🚀 Core Web Vitals');
    });

    it('should handle result without recommendations', () => {
      const resultWithoutRecommendations = {
        ...mockAuditResult,
        recommendations: [],
      };

      const summary = CIIntegration.generateGitHubActionsSummary(resultWithoutRecommendations);

      expect(summary).not.toContain('## 💡 Recommendations');
    });
  });

  describe('generateJunitXml', () => {
    it('should generate JUnit XML with bundle tests', () => {
      const xml = CIIntegration.generateJunitXml(mockAuditResult);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<testsuites>');
      expect(xml).toContain('<testsuite name="Performance Audit"');
      expect(xml).toContain('tests="3"'); // 2 bundle tests + 1 lighthouse test
      expect(xml).toContain('<testcase name="Bundle size check: main.js"');
      expect(xml).toContain('<testcase name="Bundle size check: vendor.js"');
    });

    it('should mark passing bundle tests correctly', () => {
      const xml = CIIntegration.generateJunitXml(mockAuditResult);

      expect(xml).toContain('<testcase name="Bundle size check: main.js" classname="BundleBudgetTests" time="0"/>');
    });

    it('should include Lighthouse performance test', () => {
      const xml = CIIntegration.generateJunitXml(mockAuditResult);

      expect(xml).toContain('<testcase name="Performance score: 85"');
      expect(xml).toContain('<failure message="Performance score below threshold: 85/100"/>');
    });

    it('should handle passing Lighthouse test', () => {
      const resultWithHighPerformance = {
        ...mockAuditResult,
        lighthouse: {
          ...mockAuditResult.lighthouse!,
          performance: 95,
        },
      };

      const xml = CIIntegration.generateJunitXml(resultWithHighPerformance);

      expect(xml).toContain('<testcase name="Performance score: 95" classname="LighthouseTests" time="0"/>');
    });

    it('should handle result without Lighthouse data', () => {
      const resultWithoutLighthouse = {
        ...mockAuditResult,
        lighthouse: undefined,
      };

      const xml = CIIntegration.generateJunitXml(resultWithoutLighthouse);

      expect(xml).toContain('tests="2"'); // Only bundle tests
      expect(xml).not.toContain('Performance score:');
    });

    it('should count failures and errors correctly', () => {
      const xml = CIIntegration.generateJunitXml(mockAuditResult);

      expect(xml).toContain('failures="1"'); // Lighthouse failure
      expect(xml).toContain('errors="1"'); // vendor.js warning treated as error
    });
  });

  describe('outputCIAnnotations', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should output GitHub Actions annotations for bundle errors', () => {
      const context = { isCI: true, provider: 'github' as const };
      const resultWithError = {
        ...mockAuditResult,
        bundles: [
          {
            name: 'huge.js',
            size: 500000,
            status: 'error' as const,
            type: 'client' as const,
          },
        ],
      };

      CIIntegration.outputCIAnnotations(resultWithError, context);

      expect(consoleSpy).toHaveBeenCalledWith('::error::Bundle huge.js exceeds size budget: 488.3KB');
    });

    it('should output GitHub Actions annotations for bundle warnings', () => {
      const context = { isCI: true, provider: 'github' as const };

      CIIntegration.outputCIAnnotations(mockAuditResult, context);

      expect(consoleSpy).toHaveBeenCalledWith('::warning::Bundle vendor.js approaching size budget: 195.3KB');
    });

    it('should output GitHub Actions annotations for Lighthouse warnings', () => {
      const context = { isCI: true, provider: 'github' as const };

      CIIntegration.outputCIAnnotations(mockAuditResult, context);

      expect(consoleSpy).toHaveBeenCalledWith('::warning::Lighthouse performance score below target: 85/100');
    });

    it('should output GitHub Actions summary', () => {
      const context = { isCI: true, provider: 'github' as const };

      CIIntegration.outputCIAnnotations(mockAuditResult, context);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('# 🎯 Performance Audit Report'));
    });

    it('should not output annotations for non-CI environment', () => {
      const context = { isCI: false, provider: 'unknown' as const };

      CIIntegration.outputCIAnnotations(mockAuditResult, context);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should not output annotations for non-GitHub provider', () => {
      const context = { isCI: true, provider: 'gitlab' as const };

      CIIntegration.outputCIAnnotations(mockAuditResult, context);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('getHistoricalComparison', () => {
    it('should generate trend analysis when builds are available', () => {
      const mockDb = {
        getRecentBuilds: vi.fn().mockReturnValue([
          { id: 2 },
          { id: 1 },
        ]),
        getBuildComparison: vi.fn().mockReturnValue({
          bundleDiff: [
            { name: 'main.js', delta: 5000 },
            { name: 'vendor.js', delta: -10000 },
          ],
        }),
        close: vi.fn(),
      };

      mockDatabase.mockImplementation(() => mockDb as unknown as PerformanceDatabase);

      const summary = CIIntegration.generateGitHubActionsSummary(mockAuditResult);

      expect(summary).toContain('## 📈 Trend Analysis');
      expect(summary).toContain('Compared to previous build:');
    });

    it('should handle database errors gracefully', () => {
      mockDatabase.mockImplementation(() => {
        throw new Error('Database error');
      });

      const summary = CIIntegration.generateGitHubActionsSummary(mockAuditResult);

      expect(summary).not.toContain('## 📈 Trend Analysis');
    });

    it('should handle insufficient build history', () => {
      const mockDb = {
        getRecentBuilds: vi.fn().mockReturnValue([{ id: 1 }]),
        close: vi.fn(),
      };

      mockDatabase.mockImplementation(() => mockDb as unknown as PerformanceDatabase);

      const summary = CIIntegration.generateGitHubActionsSummary(mockAuditResult);

      expect(summary).not.toContain('## 📈 Trend Analysis');
    });
  });
});
