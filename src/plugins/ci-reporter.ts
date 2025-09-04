import { Plugin } from '../core/plugin-system.js';
import { formatSize } from '../utils/size.js';

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

interface CISummary {
  status: 'success' | 'warning' | 'error';
  totalSize: string;
  totalGzipSize: string;
  bundleCount: number;
  violations: Array<{
    name: string;
    size: string;
    status: string;
  }>;
  improvements: Array<{
    name: string;
    description: string;
  }>;
  performanceScore?: number;
}

function generateCISummary(result: any): CISummary {
  const totalSize = result.bundles.reduce((sum: number, b: any) => sum + b.size, 0);
  const totalGzipSize = result.bundles.reduce((sum: number, b: any) => sum + (b.gzipSize || 0), 0);

  const violations = result.bundles
    .filter((b: any) => b.status !== 'ok')
    .map((b: any) => ({
      name: b.name,
      size: formatSize(b.size),
      status: b.status,
    }));

  const improvements: Array<{ name: string; description: string; }> = [];

  // Generate improvement suggestions based on bundle analysis
  const largeBundles = result.bundles.filter((b: any) => b.size > 150 * 1024);
  if (largeBundles.length > 0) {
    improvements.push({
      name: 'Code Splitting',
      description: `${largeBundles.length} bundle(s) are larger than 150KB. Consider code splitting.`,
    });
  }

  const manySmallBundles = result.bundles.filter((b: any) => b.size < 10 * 1024);
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
    totalSize: formatSize(totalSize),
    totalGzipSize: formatSize(totalGzipSize),
    bundleCount: result.bundles.length,
    violations,
    improvements,
    performanceScore: result.lighthouse?.performance,
  };
}

function outputGitHubActionsSummary(summary: CISummary): void {
  const { status, totalSize, totalGzipSize, bundleCount, violations, improvements } = summary;

  const statusEmoji = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }[status];

  let output = `\n## 📊 Performance Audit Summary ${statusEmoji}\n\n`;
  output += `**Status:** ${status.toUpperCase()}\n`;
  output += `**Total Size:** ${totalSize} (${totalGzipSize} gzipped)\n`;
  output += `**Bundle Count:** ${bundleCount}\n\n`;

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
  const { status, totalSize, bundleCount, violations } = summary;

  const statusEmoji = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }[status];

  console.log(`\n📊 Performance Audit ${statusEmoji}`);
  console.log(`Status: ${status.toUpperCase()}`);
  console.log(`Total Size: ${totalSize}`);
  console.log(`Bundles: ${bundleCount}`);

  if (violations.length > 0) {
    console.log(`\n⚠️ Budget Violations: ${violations.length}`);
    violations.forEach(violation => {
      console.log(`  • ${violation.name}: ${violation.size} (${violation.status})`);
    });
  }
}

export default ciReporterPlugin;
