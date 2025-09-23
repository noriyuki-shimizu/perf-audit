import fs from 'fs';
import path from 'path';
import type { PerformanceSnapshot, Plugin, TrendAnalysis } from '../types/plugin.ts';
import { formatSize } from '../utils/size.ts';

// Performance tracking plugin that monitors trends over time
export const performanceTrackerPlugin: Plugin = {
  name: 'performance-tracker',
  version: '1.0.0',
  description: 'Tracks performance trends and detects regressions',

  install: async context => {
    // Ensure tracking directory exists
    const trackingDir = path.join(process.cwd(), '.perf-audit', 'tracking');
    if (!fs.existsSync(trackingDir)) {
      fs.mkdirSync(trackingDir, { recursive: true });
    }
    context.store.set('trackingDir', trackingDir);
  },

  hooks: {
    afterAnalysis: async (context, data) => {
      if (!data) return;

      const trackingDir = context.store.get('trackingDir') as string | undefined;
      const { result } = data;

      // Create performance snapshot
      const snapshot = {
        timestamp: result.timestamp,
        server: {
          totalSize: result.serverBundles.reduce((sum, b) => sum + b.size, 0),
          totalGzipSize: result.serverBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0),
          bundleCount: result.serverBundles.length,
        },
        client: {
          totalSize: result.clientBundles.reduce((sum, b) => sum + b.size, 0),
          totalGzipSize: result.clientBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0),
          bundleCount: result.clientBundles.length,
        },
        budgetStatus: result.budgetStatus,
        lighthouse: result.lighthouse,
      };

      // Save snapshot
      const snapshotPath = path.join(trackingDir ?? '', `snapshot-${Date.now()}.json`);
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

      // Load recent snapshots for comparison
      const recentSnapshots = loadRecentSnapshots(trackingDir ?? '', 10);

      if (recentSnapshots.length > 1) {
        const trends = analyzeTrends(recentSnapshots);
        context.store.set('trends', trends);

        if (trends.alerts.length > 0) {
          context.logger.warn(`Performance alerts: ${trends.alerts.length}`);
          trends.alerts.forEach(alert => {
            context.logger.warn(`  • ${alert}`);
          });
        }
      }

      context.logger.info('Performance snapshot saved');
      context.logger.info(`Server Total Size: ${formatSize(snapshot.server.totalSize)}`);
      context.logger.info(`Client Total Size: ${formatSize(snapshot.client.totalSize)}`);
    },

    beforeReport: async (context, data) => {
      if (!data) return;

      const trends = context.store.get('trends') as TrendAnalysis | undefined;
      if (trends && trends.recommendations.length > 0) {
        data.result.recommendations = [
          ...data.result.recommendations,
          ...trends.recommendations,
        ];
      }
    },
  },
};

function loadRecentSnapshots(trackingDir: string, count: number): PerformanceSnapshot[] {
  if (!fs.existsSync(trackingDir)) {
    return [];
  }

  const files = fs.readdirSync(trackingDir)
    .filter(file => file.startsWith('snapshot-') && file.endsWith('.json'))
    .sort()
    .slice(-count);

  return files.map(file => {
    const content = fs.readFileSync(path.join(trackingDir, file), 'utf-8');
    return JSON.parse(content);
  });
}

function analyzeTrends(snapshots: PerformanceSnapshot[]): TrendAnalysis {
  if (snapshots.length < 2) {
    return {
      sizeIncrease: false,
      sizeIncreasePercent: 0,
      bundleCountChange: 0,
      alerts: [],
      recommendations: [],
    };
  }

  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  const sizeDelta = latest.totalSize - previous.totalSize;
  const sizeIncreasePercent = (sizeDelta / previous.totalSize) * 100;
  const bundleCountChange = latest.bundleCount - previous.bundleCount;

  const alerts: string[] = [];
  const recommendations: string[] = [];

  // Size increase alerts
  if (sizeDelta > 50 * 1024) { // > 50KB increase
    alerts.push(`Bundle size increased by ${formatSize(sizeDelta)} (${sizeIncreasePercent.toFixed(1)}%)`);
    recommendations.push('📈 Investigate recent changes that may have increased bundle size');
  }

  // Bundle count changes
  if (bundleCountChange > 3) {
    alerts.push(`Number of bundles increased by ${bundleCountChange}`);
    recommendations.push('📦 Consider if new bundles are necessary or can be consolidated');
  } else if (bundleCountChange < -3) {
    recommendations.push('✅ Bundle consolidation detected - good optimization!');
  }

  // Budget status regression
  if (latest.budgetStatus === 'error' && previous.budgetStatus !== 'error') {
    alerts.push('Budget status regressed to error');
  } else if (latest.budgetStatus === 'warning' && previous.budgetStatus === 'ok') {
    alerts.push('Budget status regressed to warning');
  }

  // Lighthouse performance regression
  if (latest.lighthouse && previous.lighthouse) {
    const perfDelta = latest.lighthouse.performance - previous.lighthouse.performance;
    if (perfDelta < -5) {
      alerts.push(`Lighthouse performance score decreased by ${Math.abs(perfDelta)} points`);
      recommendations.push('🎯 Investigate performance regression in recent changes');
    }
  }

  return {
    sizeIncrease: sizeDelta > 0,
    sizeIncreasePercent,
    bundleCountChange,
    alerts,
    recommendations,
  };
}

export default performanceTrackerPlugin;
