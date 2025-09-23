import { AuditResult } from '../types/config.ts';
import type { CISummary, Plugin } from '../types/plugin.ts';
import { formatSize } from '../utils/size.ts';

// CI-specific reporting plugin
export const ciReporterPlugin: Plugin = {
  name: 'ci-reporter',
  version: '1.0.0',
  description: 'Enhanced reporting for CI environments',

  hooks: {
    afterAnalysis: async (context, data) => {
      if (!data) return;

      // Check if we're in a CI environment
      const isCI = process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI;
      if (!isCI) return;

      const { result } = data;
      const summary = generateCISummary(result);

      // Store for later reporting
      context.store.set('ciSummary', summary);

      // Output GitHub Actions summary
      if (process.env.GITHUB_ACTIONS) {
        outputGitHubActionsSummary(summary);
      }

      // Output GitLab CI summary
      if (process.env.GITLAB_CI) {
        outputGitLabCISummary(summary);
      }
    },

    onError: async (context, data) => {
      if (!data) return;

      const isCI = process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI;
      if (!isCI) return;

      // CI-specific error reporting
      if (process.env.GITHUB_ACTIONS) {
        console.log(`::error::Performance audit failed: ${data.error.message}`);
      } else if (process.env.GITLAB_CI) {
        console.log(`🚨 CI Error: ${data.error.message}`);
      }
    },
  },
};

function generateCISummary(result: AuditResult): CISummary {
  const serverTotalSize = result.serverBundles.reduce((sum, b) => sum + b.size, 0);
  const serverTotalGzipSize = result.serverBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0);
  const clientTotalSize = result.clientBundles.reduce((sum, b) => sum + b.size, 0);
  const clientTotalGzipSize = result.clientBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0);

  const violations = [...result.serverBundles, ...result.clientBundles]
    .filter(b => b.status !== 'ok')
    .map(b => ({
      name: b.name,
      size: formatSize(b.size),
      status: b.status,
    }));

  const improvements: Array<{ name: string; description: string; }> = [];

  // Generate improvement suggestions based on bundle analysis
  const largeBundles = [...result.serverBundles, ...result.clientBundles].filter(b => b.size > 150 * 1024);
  if (largeBundles.length > 0) {
    improvements.push({
      name: 'Code Splitting',
      description: `${largeBundles.length} bundle(s) are larger than 150KB. Consider code splitting.`,
    });
  }

  const manySmallBundles = [...result.serverBundles, ...result.clientBundles].filter(b => b.size < 10 * 1024);
  if (manySmallBundles.length > 5) {
    improvements.push({
      name: 'Bundle Consolidation',
      description: 'Consider merging small bundles to reduce HTTP overhead.',
    });
  }

  let status: 'success' | 'warning' | 'error' = 'success';
  if (result.budgetStatus === 'error') {
    status = 'error';
  } else if (result.budgetStatus === 'warning' || violations.length > 0) {
    status = 'warning';
  }

  return {
    status,
    server: {
      totalSize: formatSize(serverTotalSize),
      totalGzipSize: formatSize(serverTotalGzipSize),
      bundleCount: result.serverBundles.length,
    },
    client: {
      totalSize: formatSize(clientTotalSize),
      totalGzipSize: formatSize(clientTotalGzipSize),
      bundleCount: result.clientBundles.length,
    },
    violations,
    improvements,
    performanceScore: result.lighthouse?.performance,
  };
}

function outputGitHubActionsSummary(summary: CISummary): void {
  const { status, server, client, violations, improvements } = summary;

  const statusEmoji = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }[status];

  let output = `\n## 📊 Performance Audit Summary ${statusEmoji}\n\n`;
  output += `**Status:** ${status.toUpperCase()}\n`;
  output += `**Server Total Size:** ${server.totalSize} (${server.totalGzipSize} gzipped)\n`;
  output += `**Server Bundle Count:** ${server.bundleCount}\n`;
  output += `**Client Total Size:** ${client.totalSize} (${client.totalGzipSize} gzipped)\n`;
  output += `**Client Bundle Count:** ${client.bundleCount}\n\n`;

  if (violations.length > 0) {
    output += `### ⚠️ Budget Violations\n\n`;
    output += `| Bundle | Size | Status |\n`;
    output += `|--------|------|--------|\n`;
    violations.forEach(violation => {
      const statusIcon = violation.status === 'error' ? '❌' : '⚠️';
      output += `| \`${violation.name}\` | ${violation.size} | ${statusIcon} ${violation.status} |\n`;
    });
    output += `\n`;
  }

  if (improvements.length > 0) {
    output += `### 💡 Improvement Suggestions\n\n`;
    improvements.forEach(improvement => {
      output += `- **${improvement.name}**: ${improvement.description}\n`;
    });
    output += `\n`;
  }

  if (summary.performanceScore) {
    output += `### 🎯 Lighthouse Performance: ${summary.performanceScore}/100\n\n`;
  }

  console.log(output);
}

function outputGitLabCISummary(summary: CISummary): void {
  const { status, server, client, violations } = summary;

  const statusEmoji = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }[status];

  console.log(`\n📊 Performance Audit ${statusEmoji}`);
  console.log(`Status: ${status.toUpperCase()}`);
  console.log(`Server Total Size: ${server.totalSize}`);
  console.log(`Server Bundle Count: ${server.bundleCount}`);
  console.log(`Client Total Size: ${client.totalSize}`);
  console.log(`Client Bundle Count: ${client.bundleCount}`);

  if (violations.length > 0) {
    console.log(`\n⚠️ Budget Violations: ${violations.length}`);
    violations.forEach(violation => {
      console.log(`  • ${violation.name}: ${violation.size} (${violation.status})`);
    });
  }
}

export default ciReporterPlugin;
