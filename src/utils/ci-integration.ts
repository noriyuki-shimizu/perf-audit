import { PerformanceDatabaseService } from '../core/database/index.ts';
import type { AuditResult, CIContext } from '../types/config.ts';
import { formatSize } from './size.ts';

export class CIIntegration {
  static detectCIEnvironment(): CIContext {
    const env = process.env;

    // GitHub Actions
    if (env.GITHUB_ACTIONS) {
      return {
        isCI: true,
        provider: 'github',
        branch: env.GITHUB_REF_NAME,
        commitHash: env.GITHUB_SHA,
        pullRequestId: env.GITHUB_EVENT_NAME === 'pull_request'
          ? env.GITHUB_EVENT_NUMBER
          : undefined,
        buildNumber: env.GITHUB_RUN_NUMBER,
      };
    }

    // GitLab CI
    if (env.GITLAB_CI) {
      return {
        isCI: true,
        provider: 'gitlab',
        branch: env.CI_COMMIT_REF_NAME,
        commitHash: env.CI_COMMIT_SHA,
        pullRequestId: env.CI_MERGE_REQUEST_IID,
        buildNumber: env.CI_PIPELINE_ID,
      };
    }

    // Jenkins
    if (env.JENKINS_URL) {
      return {
        isCI: true,
        provider: 'jenkins',
        branch: env.GIT_BRANCH,
        commitHash: env.GIT_COMMIT,
        buildNumber: env.BUILD_NUMBER,
      };
    }

    // Generic CI detection
    if (env.CI) {
      return {
        isCI: true,
        provider: 'unknown',
        branch: env.BRANCH,
        commitHash: env.COMMIT_SHA,
      };
    }

    return {
      isCI: false,
      provider: 'unknown',
    };
  }

  static async generateGitHubActionsSummary(result: AuditResult): Promise<string> {
    const serverTotalSize = result.serverBundles.reduce((sum, b) => sum + b.size, 0);
    const serverTotalGzipSize = result.serverBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0);
    const clientTotalSize = result.clientBundles.reduce((sum, b) => sum + b.size, 0);
    const clientTotalGzipSize = result.clientBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0);

    const statusEmoji = {
      ok: '✅',
      warning: '⚠️',
      error: '❌',
    };

    let summary = `# 🎯 Performance Audit Report\n\n`;
    summary += `**Status:** ${statusEmoji[result.budgetStatus]} ${result.budgetStatus.toUpperCase()}\n`;
    summary += `**Server Total Size:** ${formatSize(serverTotalSize)} (${formatSize(serverTotalGzipSize)} gzipped)\n`;
    summary += `**Server Bundles:** ${result.serverBundles.length}\n`;
    summary += `**Client Total Size:** ${formatSize(clientTotalSize)} (${formatSize(clientTotalGzipSize)} gzipped)\n`;
    summary += `**Client Bundles:** ${result.clientBundles.length}\n\n`;

    // Server Bundle breakdown
    summary += `## 📦 Server Bundle Analysis\n\n`;
    summary += `| Bundle | Size | Gzipped | Status |\n`;
    summary += `|--------|------|---------|--------|\n`;

    result.serverBundles.forEach(bundle => {
      const gzipText = bundle.gzipSize ? formatSize(bundle.gzipSize) : 'N/A';
      const statusIcon = statusEmoji[bundle.status];
      summary += `| \`${bundle.name}\` | ${formatSize(bundle.size)} | ${gzipText} | ${statusIcon} ${bundle.status} |\n`;
    });

    // Client Bundle breakdown
    summary += `## 📦 Client Bundle Analysis\n\n`;
    summary += `| Bundle | Size | Gzipped | Status |\n`;
    summary += `|--------|------|---------|--------|\n`;

    result.clientBundles.forEach(bundle => {
      const gzipText = bundle.gzipSize ? formatSize(bundle.gzipSize) : 'N/A';
      const statusIcon = statusEmoji[bundle.status];
      summary += `| \`${bundle.name}\` | ${formatSize(bundle.size)} | ${gzipText} | ${statusIcon} ${bundle.status} |\n`;
    });

    // Lighthouse scores
    if (result.lighthouse) {
      summary += `\n## 📊 Lighthouse Scores\n\n`;
      summary += `| Category | Score |\n`;
      summary += `|----------|-------|\n`;
      summary += `| Performance | ${result.lighthouse.performance}/100 |\n`;
      if (result.lighthouse.accessibility) {
        summary += `| Accessibility | ${result.lighthouse.accessibility}/100 |\n`;
      }
      if (result.lighthouse.bestPractices) {
        summary += `| Best Practices | ${result.lighthouse.bestPractices}/100 |\n`;
      }
      if (result.lighthouse.seo) {
        summary += `| SEO | ${result.lighthouse.seo}/100 |\n`;
      }

      if (result.lighthouse.metrics) {
        summary += `\n## 🚀 Core Web Vitals\n\n`;
        summary += `| Metric | Value |\n`;
        summary += `|--------|-------|\n`;
        summary += `| First Contentful Paint | ${result.lighthouse.metrics.fcp}ms |\n`;
        summary += `| Largest Contentful Paint | ${result.lighthouse.metrics.lcp}ms |\n`;
        summary += `| Cumulative Layout Shift | ${result.lighthouse.metrics.cls} |\n`;
        summary += `| Time to Interactive | ${result.lighthouse.metrics.tti}ms |\n`;
      }
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      summary += `\n## 💡 Recommendations\n\n`;
      result.recommendations.forEach(rec => {
        summary += `- ${rec}\n`;
      });
    }

    // Historical comparison
    const comparison = await this.getHistoricalComparison();
    if (comparison) {
      summary += `\n## 📈 Trend Analysis\n\n`;
      summary += comparison;
    }

    summary += `\n---\n`;
    summary += `Generated by perf-audit-cli on ${new Date(result.timestamp).toLocaleString()}\n`;

    return summary;
  }

  static generateJunitXml(result: AuditResult): string {
    const testCases: string[] = [];

    // Server Bundle budget tests
    result.serverBundles.forEach(bundle => {
      const testName = `Server Bundle size check: ${bundle.name}`;
      const className = 'ServerBundleBudgetTests';

      if (bundle.status === 'ok') {
        testCases.push(`    <testcase name="${testName}" classname="${className}" time="0"/>`);
      } else {
        const message = `Bundle ${bundle.name} exceeds budget: ${formatSize(bundle.size)}`;
        const type = bundle.status === 'error' ? 'failure' : 'error';
        testCases.push(`    <testcase name="${testName}" classname="${className}" time="0">
      <${type} message="${message}"/>
    </testcase>`);
      }
    });

    // Client Bundle budget tests
    result.clientBundles.forEach(bundle => {
      const testName = `Client Bundle size check: ${bundle.name}`;
      const className = 'ClientBundleBudgetTests';

      if (bundle.status === 'ok') {
        testCases.push(`    <testcase name="${testName}" classname="${className}" time="0"/>`);
      } else {
        const message = `Bundle ${bundle.name} exceeds budget: ${formatSize(bundle.size)}`;
        const type = bundle.status === 'error' ? 'failure' : 'error';
        testCases.push(`    <testcase name="${testName}" classname="${className}" time="0">
      <${type} message="${message}"/>
    </testcase>`);
      }
    });

    // Lighthouse tests
    if (result.lighthouse) {
      const performanceTest = `Performance score: ${result.lighthouse.performance}`;
      if (result.lighthouse.performance >= 90) {
        testCases.push(`    <testcase name="${performanceTest}" classname="LighthouseTests" time="0"/>`);
      } else {
        testCases.push(`    <testcase name="${performanceTest}" classname="LighthouseTests" time="0">
      <failure message="Performance score below threshold: ${result.lighthouse.performance}/100"/>
    </testcase>`);
      }
    }

    const totalTests = testCases.length;
    const failures = testCases.filter(tc => tc.includes('<failure')).length;
    const errors = testCases.filter(tc => tc.includes('<error')).length;

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Performance Audit" tests="${totalTests}" failures="${failures}" errors="${errors}" time="0">
${testCases.join('\n')}
  </testsuite>
</testsuites>`;
  }

  static async outputCIAnnotations(result: AuditResult, ciContext: CIContext): Promise<void> {
    if (!ciContext.isCI) return;

    // GitHub Actions annotations
    if (ciContext.provider === 'github') {
      result.serverBundles.forEach(bundle => {
        if (bundle.status === 'error') {
          console.log(`::error::Server Bundle ${bundle.name} exceeds size budget: ${formatSize(bundle.size)}`);
        } else if (bundle.status === 'warning') {
          console.log(`::warning::Server Bundle ${bundle.name} approaching size budget: ${formatSize(bundle.size)}`);
        }
      });
      result.clientBundles.forEach(bundle => {
        if (bundle.status === 'error') {
          console.log(`::error::Client Bundle ${bundle.name} exceeds size budget: ${formatSize(bundle.size)}`);
        } else if (bundle.status === 'warning') {
          console.log(`::warning::Client Bundle ${bundle.name} approaching size budget: ${formatSize(bundle.size)}`);
        }
      });

      if (result.lighthouse && result.lighthouse.performance < 90) {
        console.log(`::warning::Lighthouse performance score below target: ${result.lighthouse.performance}/100`);
      }

      // Add GitHub Actions summary
      const summary = await this.generateGitHubActionsSummary(result);
      console.log(`\n${summary}`);
    }

    // GitLab CI annotations would go here
    // Jenkins annotations would go here
  }

  private static async getHistoricalComparison(): Promise<string | null> {
    try {
      const db = await PerformanceDatabaseService.instance();
      const recent = await db.getRecentBuilds({ limit: 2, orderBy: 'ASC' });

      if (recent.length < 2) {
        await db.close();
        return null;
      }

      const [current, previous] = recent;
      const comparison = await db.getBuildComparison(current.id, previous.id);
      await db.close();

      if (comparison.bundleDiff.length === 0) return null;

      let trend = `Compared to previous build:\n`;
      comparison.bundleDiff.forEach(diff => {
        const change = diff.delta > 0 ? `+${formatSize(diff.delta)}` : formatSize(diff.delta);
        const arrow = diff.delta > 0 ? '📈' : '📉';
        trend += `- \`${diff.name}\`: ${change} ${arrow}\n`;
      });

      return trend;
    } catch {
      return null;
    }
  }
}
