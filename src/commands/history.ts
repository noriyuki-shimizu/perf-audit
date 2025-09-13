import { PerformanceDatabaseService } from '../core/database/index.ts';
import type { HistoryOptions } from '../types/commands.ts';
import type { TrendData } from '../types/database/index.ts';
import { Logger } from '../utils/logger.ts';
import { formatSize } from '../utils/size.ts';

/**
 * Execute performance history command to display historical performance data
 * @param options - History command options including format and metric filters
 */
export async function historyCommand(options: HistoryOptions): Promise<void> {
  const db = await PerformanceDatabaseService.instance();

  try {
    const trendData = await db.getTrendData(options.days);
    const recentBuilds = await db.getRecentBuilds(10);

    if (options.format === 'json') {
      const output = {
        period: `${options.days} days`,
        trendData,
        recentBuilds,
        summary: generateSummary(trendData),
      };
      Logger.json(output);
      return;
    }

    // Console output
    Logger.title(`Performance History (Last ${options.days} days)`);

    if (trendData.length === 0) {
      Logger.warn('No historical data found. Run some audits first!');
      return;
    }

    // Show trend data
    if (options.metric) {
      displaySpecificMetric(trendData, options.metric);
    } else {
      displayOverview(trendData);
    }

    // Show recent builds
    Logger.section('Recent Builds');
    recentBuilds.slice(0, 5).forEach((build, index) => {
      const date = new Date(build.timestamp).toLocaleDateString();
      const time = new Date(build.timestamp).toLocaleTimeString();
      const branch = build.branch ? ` (${build.branch})` : '';
      const device = build.device ? ` [${build.device}]` : '';

      Logger.info(`${index + 1}. ${date} ${time}${branch}${device}`);
    });

    // Show summary
    const summary = generateSummary(trendData);
    Logger.section('Summary');
    Logger.info(`Total builds: ${trendData.length}`);
    Logger.info(`Avg bundle size: ${formatSize(summary.avgBundleSize)}`);
    Logger.info(`Size trend: ${summary.sizeTrend > 0 ? '📈' : '📉'} ${formatSize(Math.abs(summary.sizeTrend))}`);

    if (summary.avgPerformanceScore > 0) {
      Logger.info(`Avg performance: ${summary.avgPerformanceScore.toFixed(1)}/100`);
    }
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    db.close();
  }
}

/**
 * Display overview of performance trends including bundle sizes and Core Web Vitals
 * @param trendData - Array of historical trend data
 */
function displayOverview(trendData: TrendData[]): void {
  Logger.section('Bundle Size Trend');
  const recentData = trendData.slice(0, 10);

  recentData.forEach(data => {
    const date = data.date;
    const size = formatSize(data.totalSize);
    const gzipSize = data.gzipSize ? ` (${formatSize(data.gzipSize)} gzipped)` : '';
    const perf = data.performanceScore ? ` | Perf: ${data.performanceScore}/100` : '';

    Logger.info(`${date}: ${size}${gzipSize}${perf}`);
  });

  if (recentData.some(d => d.fcp)) {
    Logger.section('Core Web Vitals Trend');
    recentData.forEach(data => {
      if (data.fcp) {
        Logger.info(`${data.date}: FCP ${data.fcp}ms | LCP ${data.lcp}ms | CLS ${data.cls} | TTI ${data.tti}ms`);
      }
    });
  }
}

/**
 * Display trend data for a specific performance metric
 * @param trendData - Array of historical trend data
 * @param metric - Specific metric to display (size, gzip-size, performance, fcp, lcp, cls, tti)
 */
function displaySpecificMetric(trendData: TrendData[], metric: string): void {
  Logger.section(`${metric.toUpperCase()} Trend`);

  trendData.slice(0, 15).forEach(data => {
    let value: string = 'N/A';

    switch (metric.toLowerCase()) {
      case 'size':
      case 'bundle-size':
        value = formatSize(data.totalSize);
        break;
      case 'gzip-size':
        value = data.gzipSize ? formatSize(data.gzipSize) : 'N/A';
        break;
      case 'performance':
        value = data.performanceScore ? `${data.performanceScore}/100` : 'N/A';
        break;
      case 'fcp':
        value = data.fcp ? `${data.fcp}ms` : 'N/A';
        break;
      case 'lcp':
        value = data.lcp ? `${data.lcp}ms` : 'N/A';
        break;
      case 'cls':
        value = data.cls ? data.cls.toString() : 'N/A';
        break;
      case 'tti':
        value = data.tti ? `${data.tti}ms` : 'N/A';
        break;
    }

    Logger.info(`${data.date}: ${value}`);
  });
}

/**
 * Generate summary statistics from historical trend data
 * @param trendData - Array of historical trend data
 * @returns Summary object containing average bundle size, size trend, and average performance score
 */
function generateSummary(trendData: TrendData[]): {
  avgBundleSize: number;
  sizeTrend: number;
  avgPerformanceScore: number;
} {
  if (trendData.length === 0) {
    return { avgBundleSize: 0, sizeTrend: 0, avgPerformanceScore: 0 };
  }

  const avgBundleSize = trendData.reduce((sum, d) => sum + d.totalSize, 0) / trendData.length;

  // Calculate size trend (difference between most recent and oldest)
  const sizeTrend = trendData.length > 1
    ? trendData[0].totalSize - trendData[trendData.length - 1].totalSize
    : 0;

  const performanceScores = trendData.filter(d => d.performanceScore).map(d => d.performanceScore!);
  const avgPerformanceScore = performanceScores.length > 0
    ? performanceScores.reduce((sum, score) => sum + score, 0) / performanceScores.length
    : 0;

  return {
    avgBundleSize,
    sizeTrend,
    avgPerformanceScore,
  };
}
