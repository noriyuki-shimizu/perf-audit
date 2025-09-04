import chalk from 'chalk';
import { AuditResult, BundleInfo, PerfAuditConfig } from '../types/config.js';
import { formatDelta, formatSize } from './size.js';

export class ConsoleReporter {
  private config: PerfAuditConfig;

  constructor(config: PerfAuditConfig) {
    this.config = config;
  }

  reportBundleAnalysis(
    result: AuditResult,
    totalSizes: { size: number; gzipSize?: number; },
    showDetails: boolean = false,
  ): void {
    console.log(chalk.blue('\n🎯 Performance Audit Report'));
    console.log(chalk.blue('═══════════════════════════════════════════'));

    // Bundle analysis section
    console.log(chalk.blue('\n📦 Bundle Analysis'));

    result.bundles.forEach(bundle => {
      const status = this.getStatusIcon(bundle.status);
      const sizeText = formatSize(bundle.size);
      const gzipText = bundle.gzipSize ? ` (gzip: ${formatSize(bundle.gzipSize)})` : '';
      const deltaText = bundle.delta ? ` ${this.formatDelta(bundle.delta)}` : '';

      console.log(`├─ ${bundle.name}: ${sizeText}${gzipText} ${status}${deltaText}`);

      if (showDetails && bundle.status !== 'ok') {
        this.showBundleDetails(bundle);
      }
    });

    // Total size
    const totalSizeText = formatSize(totalSizes.size);
    const totalGzipText = totalSizes.gzipSize ? ` (gzip: ${formatSize(totalSizes.gzipSize)})` : '';
    console.log(`└─ Total: ${totalSizeText}${totalGzipText}`);

    // Performance metrics (if available)
    if (result.lighthouse) {
      this.reportPerformanceMetrics(result.lighthouse);
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      console.log(chalk.blue('\n💡 Recommendations:'));
      result.recommendations.forEach(rec => {
        console.log(`- ${rec}`);
      });
    }

    // Overall status
    console.log(this.getOverallStatus(result.budgetStatus));
  }

  reportBudgetCheck(result: AuditResult): void {
    console.log(chalk.blue('\n💰 Budget Check Report'));
    console.log(chalk.blue('═══════════════════════════════════════════'));

    let hasViolations = false;

    result.bundles.forEach(bundle => {
      if (bundle.status !== 'ok') {
        hasViolations = true;
        const status = this.getStatusIcon(bundle.status);
        const sizeText = formatSize(bundle.size);

        console.log(`${status} ${bundle.name}: ${sizeText}`);

        // Show budget details
        const budgetKey = this.getBundgetKey(bundle.name);
        const budget = this.config.budgets.bundles[budgetKey];
        if (budget) {
          console.log(`   Budget: ${budget.warning} (warning) / ${budget.max} (max)`);
        }
      }
    });

    if (!hasViolations) {
      console.log(chalk.green('✅ All bundles are within budget limits'));
    }

    console.log(this.getOverallStatus(result.budgetStatus));
  }

  reportLighthouseResults(result: AuditResult): void {
    if (!result.lighthouse) return;

    const metrics = result.lighthouse;

    // Lighthouse scores
    console.log(chalk.blue('\n📊 Lighthouse Scores'));
    console.log(
      `├─ Performance: ${this.formatScore(metrics.performance)}/100 ${this.getScoreIcon(metrics.performance)}`,
    );
    console.log(
      `├─ Accessibility: ${this.formatScore(metrics.accessibility || 0)}/100 ${
        this.getScoreIcon(metrics.accessibility || 0)
      }`,
    );
    console.log(
      `├─ Best Practices: ${this.formatScore(metrics.bestPractices || 0)}/100 ${
        this.getScoreIcon(metrics.bestPractices || 0)
      }`,
    );
    console.log(`└─ SEO: ${this.formatScore(metrics.seo || 0)}/100 ${this.getScoreIcon(metrics.seo || 0)}`);

    // Core Web Vitals
    console.log(chalk.blue('\n🚀 Core Web Vitals'));
    if (metrics.metrics) {
      const { fcp, lcp, cls, tti } = metrics.metrics;

      console.log(`├─ FCP: ${fcp}ms ${this.getMetricStatus(fcp, this.config.budgets.metrics.fcp)}`);
      console.log(`├─ LCP: ${lcp}ms ${this.getMetricStatus(lcp, this.config.budgets.metrics.lcp)}`);
      console.log(`├─ CLS: ${cls} ${this.getMetricStatus(cls, this.config.budgets.metrics.cls)}`);
      console.log(`└─ TTI: ${tti}ms ${this.getMetricStatus(tti, this.config.budgets.metrics.tti)}`);
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      console.log(chalk.blue('\n💡 Performance Recommendations:'));
      result.recommendations.forEach(rec => {
        console.log(`- ${rec}`);
      });
    }

    console.log(this.getOverallStatus(result.budgetStatus));
  }

  private formatScore(score: number): string {
    return score.toString().padStart(2);
  }

  private getScoreIcon(score: number): string {
    if (score >= 90) return chalk.green('✅');
    if (score >= 75) return chalk.yellow('⚠️');
    return chalk.red('❌');
  }

  private reportPerformanceMetrics(
    metrics: { performance?: number; metrics?: { fcp: number; lcp: number; cls: number; tti: number; }; },
  ): void {
    console.log(chalk.blue('\n📊 Performance Metrics'));

    if (metrics.performance !== undefined) {
      const status = metrics.performance >= 90 ? '✅' : metrics.performance >= 75 ? '⚠️' : '❌';
      console.log(`├─ Performance Score: ${metrics.performance}/100 ${status}`);
    }

    if (metrics.metrics) {
      const { fcp, lcp, cls, tti } = metrics.metrics;

      console.log(`├─ FCP: ${fcp}ms ${this.getMetricStatus(fcp, this.config.budgets.metrics.fcp)}`);
      console.log(`├─ LCP: ${lcp}ms ${this.getMetricStatus(lcp, this.config.budgets.metrics.lcp)}`);
      console.log(`├─ CLS: ${cls} ${this.getMetricStatus(cls, this.config.budgets.metrics.cls)}`);
      console.log(`└─ TTI: ${tti}ms ${this.getMetricStatus(tti, this.config.budgets.metrics.tti)}`);
    }
  }

  private getStatusIcon(status: 'ok' | 'warning' | 'error'): string {
    switch (status) {
      case 'ok':
        return chalk.green('✅');
      case 'warning':
        return chalk.yellow('⚠️');
      case 'error':
        return chalk.red('❌');
      default:
        return '';
    }
  }

  private formatDelta(delta: number): string {
    const formatted = formatDelta(delta);
    if (delta > 0) {
      return chalk.red(formatted);
    } else if (delta < 0) {
      return chalk.green(formatted);
    }
    return formatted;
  }

  private showBundleDetails(bundle: BundleInfo): void {
    const indent = '   ';
    console.log(chalk.dim(`${indent}Size: ${formatSize(bundle.size)}`));
    if (bundle.gzipSize) {
      console.log(chalk.dim(`${indent}Gzipped: ${formatSize(bundle.gzipSize)}`));
    }
  }

  private getMetricStatus(value: number, budget: { max: number; warning: number; }): string {
    if (value >= budget.max) {
      return chalk.red(`❌ (budget: ${budget.max})`);
    } else if (value >= budget.warning) {
      return chalk.yellow(`⚠️ (budget: ${budget.warning})`);
    }
    return chalk.green('✅');
  }

  private getOverallStatus(status: 'ok' | 'warning' | 'error'): string {
    const timestamp = new Date().toLocaleString();

    switch (status) {
      case 'ok':
        return chalk.green(`\n✅ All checks passed! (${timestamp})`);
      case 'warning':
        return chalk.yellow(`\n⚠️  Some warnings detected (${timestamp})`);
      case 'error':
        return chalk.red(`\n❌ Budget violations detected! (${timestamp})`);
      default:
        return '';
    }
  }

  private getBundgetKey(bundleName: string): string {
    const name = bundleName.toLowerCase();

    if (name.includes('main') || name.includes('index')) return 'main';
    if (name.includes('vendor') || name.includes('chunk')) return 'vendor';
    if (name.includes('runtime')) return 'runtime';

    return 'main';
  }
}
