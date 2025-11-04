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
    const trendData = await db.getTrendData(options.days, 'DESC');
    const recentBuilds = await db.getRecentBuilds({ limit: 30, orderBy: 'DESC' });
    const clientTrendData = trendData.filter(data => data.type === 'client');
    const serverTrendData = trendData.filter(data => data.type === 'server');

    if (options.format === 'json') {
      const output = {
        period: `${options.days} days`,
        trendData,
        recentBuilds,
        clientSummary: generateSummary(clientTrendData),
        serverSummary: generateSummary(serverTrendData),
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
    Logger.section('Server Bundle Size Trend');
    displayOverview(serverTrendData);
    Logger.section('Client Bundle Size Trend');
    displayOverview(clientTrendData);

    // Show recent builds
    Logger.section('Recent Builds');
    recentBuilds.forEach((build, index) => {
      const date = new Date(build.timestamp).toLocaleDateString();
      const time = new Date(build.timestamp).toLocaleTimeString();
      const branch = build.branch ? ` (${build.branch})` : '';
      const device = build.device ? ` [${build.device}]` : '';

      Logger.info(`${index + 1}. ${date} ${time}${branch}${device}`);
    });

    Logger.section('Lighthouse Score (Core Web Vitals Trend)');
    displayLighthouseScore(trendData);

    const clientSummary = generateSummary(clientTrendData);

    Logger.section('Summary');
    Logger.info(`Total builds: ${trendData.length}`);
    Logger.raw('===== Client Bundles =====');
    Logger.info(`Avg bundle size: ${formatSize(clientSummary.avgBundleSize)}`);
    Logger.info(
      `Size trend: ${clientSummary.sizeTrend > 0 ? '📈' : '📉'} ${formatSize(Math.abs(clientSummary.sizeTrend))}`,
    );

    if (clientSummary.avgPerformanceScore > 0) {
      Logger.info(`Avg performance: ${clientSummary.avgPerformanceScore.toFixed(1)}/100`);
    }

    const serverSummary = generateSummary(serverTrendData);

    Logger.raw('===== Server Bundles =====');
    Logger.info(`Avg bundle size: ${formatSize(serverSummary.avgBundleSize)}`);
    Logger.info(
      `Size trend: ${serverSummary.sizeTrend > 0 ? '📈' : '📉'} ${formatSize(Math.abs(serverSummary.sizeTrend))}`,
    );

    if (serverSummary.avgPerformanceScore > 0) {
      Logger.info(`Avg performance: ${serverSummary.avgPerformanceScore.toFixed(1)}/100`);
    }
  } catch (error) {
    Logger.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await db.close();
  }
}

/**
 * Display overview of bundle size trends
 * @param trendData - Array of historical trend data
 */
function displayOverview(trendData: TrendData[]): void {
  trendData.forEach(data => {
    const date = data.date;
    const size = formatSize(data.totalSize);
    const gzipSize = data.gzipSize ? ` (${formatSize(data.gzipSize)} gzipped)` : '';
    const perf = data.performanceScore ? ` | Perf: ${data.performanceScore}/100` : '';

    Logger.info(`${date}: ${size}${gzipSize}${perf}`);
  });
}

/**
 * Display Lighthouse performance scores and Core Web Vitals trends
 * @param trendData - Array of historical trend data
 */
function displayLighthouseScore(trendData: TrendData[]): void {
  const filteredData = trendData.filter(d => d.performanceScore);

  if (filteredData.length === 0) {
    Logger.warn('No Lighthouse score data found.');
    return;
  }

  filteredData.forEach(data => {
    Logger.info(
      `${data.date}: [Performance ${data.performanceScore}/100] FCP ${data.fcp}ms | LCP ${data.lcp}ms | CLS ${data.cls} | TTI ${data.tti}ms`,
    );
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
