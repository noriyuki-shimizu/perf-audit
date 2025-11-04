import type { BundleDiff } from '../../types/bundle.ts';
import type { BundleInfo } from '../../types/config.ts';
import type {
  BuildBundleMetricRecord,
  BuildRecord,
  DatabaseConfig,
  NewBuildRecord,
  Repository,
  TrendData,
} from '../../types/database/index.ts';
import type { MetricDiff } from '../../types/metric.ts';
import { DatabaseFactory } from './factory.ts';

/**
 * パフォーマンス データベースサービス
 * 高レベルなデータベース操作を提供し、既存のAPIとの互換性を保つ
 */
export class PerformanceDatabaseService {
  private static _instance: PerformanceDatabaseService;
  private repository: Repository;
  private config: DatabaseConfig;

  private constructor(config?: DatabaseConfig) {
    this.config = config || DatabaseFactory.createConfigFromEnv();
    this.repository = DatabaseFactory.createRepository(this.config);
  }

  /**
   * シングルトンインスタンスを取得（同期版 - テスト用）
   */
  public static async instance(): Promise<PerformanceDatabaseService> {
    if (!this._instance) {
      const config = DatabaseFactory.createConfigFromEnv();

      this._instance = new PerformanceDatabaseService(config);
      await this._instance.repository.initSchema();
    }

    return this._instance;
  }

  /**
   * データベースをクリーンアップ
   */
  async cleanDatabase(): Promise<void> {
    await this.repository.cleanAll();
  }

  /**
   * ビルドデータを保存（非同期版）
   */
  saveBuild(data: NewBuildRecord): Promise<number | bigint> {
    return this.repository.builds.create(data).then(async buildId => {
      const savePromises: Promise<void>[] = [];

      // バンドルを保存
      if (data.bundles.length > 0) {
        savePromises.push(this.repository.bundles.createMany(buildId, data.bundles));
      }

      // メトリクスを保存
      if (data.metrics) {
        const metricsToSave: Array<{ name: string; value: number; }> = [
          { name: 'performance_score', value: data.metrics.performance },
          { name: 'accessibility_score', value: data.metrics.accessibility || 0 },
          { name: 'best_practices_score', value: data.metrics.bestPractices || 0 },
          { name: 'seo_score', value: data.metrics.seo || 0 },
        ];

        if (data.metrics.metrics) {
          metricsToSave.push(
            { name: 'fcp', value: data.metrics.metrics.fcp },
            { name: 'lcp', value: data.metrics.metrics.lcp },
            { name: 'cls', value: data.metrics.metrics.cls },
            { name: 'tti', value: data.metrics.metrics.tti },
          );
        }

        savePromises.push(this.repository.metrics.createMany(buildId, metricsToSave));
      }

      // 推奨事項を保存
      if (data.recommendations.length > 0) {
        savePromises.push(
          this.repository.recommendations.createMany(buildId, data.recommendations, 'performance'),
        );
      }

      await Promise.all(savePromises);
      return buildId;
    });
  }

  /**
   * トレンドデータを取得（非同期版）
   */
  getTrendData(days = 30, orderBy: 'ASC' | 'DESC' = 'ASC'): Promise<TrendData[]> {
    return this.repository.builds.getTrendData(days, orderBy);
  }

  /**
   * 最新のビルドを取得（非同期版）
   */
  async getRecentBuilds(
    param: {
      startDate?: string;
      endDate?: string;
      limit: number;
      orderBy: 'ASC' | 'DESC';
    },
  ): Promise<(BuildRecord & { bundles: BundleInfo[]; recommendations: string[]; })[]> {
    const { startDate, endDate, limit, orderBy } = param;
    const builds = await this.repository.builds.findByStartDateAndEndDate(
      { startDate, endDate },
      limit,
      orderBy,
    );

    return Promise.all(
      builds.map(async build => ({
        ...build,
        bundles: await this.repository.bundles.findByBuildId(build.id),
        recommendations: await this.repository.recommendations.findByBuildId(build.id),
      })),
    );
  }

  /**
   * ビルドを取得（同期版）
   */
  async getBuild(
    buildId: number,
  ): Promise<(BuildRecord & { bundles: BundleInfo[]; recommendations: string[]; }) | null> {
    const build = await this.repository.builds.findById(buildId);

    if (build === undefined) {
      return null;
    }

    const bundles = await this.repository.bundles.findByBuildId(buildId);
    const recommendations = await this.repository.recommendations.findByBuildId(buildId);

    return {
      ...build,
      bundles: Array.isArray(bundles) ? bundles : [],
      recommendations: Array.isArray(recommendations) ? recommendations : [],
    };
  }

  /**
   * ビルド比較を取得（同期版）
   */
  getBuildComparison(buildId1: number, buildId2: number): Promise<{
    build1: BuildBundleMetricRecord | undefined;
    build2: BuildBundleMetricRecord | undefined;
    bundleDiff: BundleDiff[];
    metricDiff: MetricDiff[];
  }> {
    return this.repository.builds.getComparison(buildId1, buildId2);
  }

  /**
   * 古いビルドをクリーンアップ
   */
  cleanup(retentionDays: number): Promise<number> {
    return this.repository.builds.cleanup(retentionDays);
  }

  /**
   * 接続を閉じる
   */
  async close(): Promise<void> {
    if (this.repository) {
      await this.repository.close();
    }
  }

  /**
   * バンドルサイズの統計を取得
   */
  async getBundleStats(days = 30): Promise<{
    totalBuilds: number;
    averageSize: number;
    largestBundles: (BundleInfo & { buildId: number; })[];
  }> {
    const [builds, largestBundles] = await Promise.all([
      this.repository.builds.findByDateRange(
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString(),
      ),
      this.repository.bundles.findLargeBundles(100000, 10), // 100KB以上
    ]);

    // 平均サイズを計算（簡易版）
    const bundleIds = builds.map(b => b.id);
    let totalSize = 0;
    let bundleCount = 0;

    for (const buildId of bundleIds.slice(0, 10)) { // 最新10ビルドの平均
      const bundles = await this.repository.bundles.findByBuildId(buildId);
      totalSize += bundles.reduce((sum, bundle) => sum + bundle.size, 0);
      bundleCount += bundles.length;
    }

    return {
      totalBuilds: builds.length,
      averageSize: bundleCount > 0 ? totalSize / bundleCount : 0,
      largestBundles,
    };
  }

  /**
   * パフォーマンスメトリクスの統計を取得
   */
  async getPerformanceStats(metricName = 'performance_score', days = 30): Promise<{
    average: number;
    min: number;
    max: number;
    count: number;
    history: Array<{ buildId: number; value: number; timestamp: string; }>;
  }> {
    const [stats, history] = await Promise.all([
      this.repository.metrics.getMetricStats(metricName, days),
      this.repository.metrics.findMetricHistory(metricName, days),
    ]);

    return {
      ...stats,
      history,
    };
  }

  /**
   * よく出現する推奨事項を取得
   */
  getFrequentRecommendations(days = 30, limit = 10): Promise<Array<{ message: string; count: number; }>> {
    return this.repository.recommendations.findFrequentRecommendations(days, limit);
  }

  /**
   * バックアップ作成（SQLite専用）
   */
  async backup(destinationPath: string): Promise<void> {
    // SQLite接続の場合のみバックアップをサポート
    if (this.config.type === 'sqlite') {
      const connection = await DatabaseFactory.createConnection(this.config);
      if ('backup' in connection && typeof connection.backup === 'function') {
        await connection.backup(destinationPath);
      } else {
        throw new Error('Backup is not supported for this database type');
      }
    } else {
      throw new Error('Backup is only supported for SQLite databases');
    }
  }

  /**
   * データベース最適化（SQLite専用）
   */
  async vacuum(): Promise<void> {
    if (this.config.type === 'sqlite') {
      const connection = await DatabaseFactory.createConnection(this.config);
      if ('vacuum' in connection && typeof connection.vacuum === 'function') {
        await connection.vacuum();
      }
    }
  }
}
