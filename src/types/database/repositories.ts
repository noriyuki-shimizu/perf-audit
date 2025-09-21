import type { BundleDiff } from '../bundle.ts';
import type { BundleInfo } from '../config.ts';
import type { MetricDiff } from '../metric.ts';
import type { BuildBundleMetricRecord, BuildRecord, NewBuildRecord, TrendData } from './model.ts';

/**
 * Buildsテーブルの操作を定義するリポジトリインターフェース
 */
export interface BuildRepository {
  /**
   * 新しいビルドレコードを作成
   */
  create(data: Omit<NewBuildRecord, 'bundles' | 'metrics' | 'recommendations'>): Promise<number | bigint>;

  /**
   * IDでビルドを取得
   */
  findById(id: number): Promise<BuildRecord | undefined>;

  /**
   * 最新のビルドを取得
   */
  findByStartDateAndEndDate(
    whereParam: { startDate?: string; endDate?: string; },
    limit: number,
    orderBy: 'ASC' | 'DESC',
  ): Promise<BuildRecord[]>;

  /**
   * 期間内のビルドを取得
   */
  findByDateRange(startDate: string, endDate: string): Promise<BuildRecord[]>;

  /**
   * トレンドデータを取得
   */
  getTrendData(days?: number): Promise<TrendData[]>;

  /**
   * 古いビルドをクリーンアップ
   */
  cleanup(retentionDays: number): Promise<number>;

  /**
   * ビルド比較データを取得
   */
  getComparison(buildId1: number, buildId2: number): Promise<{
    build1: BuildBundleMetricRecord | undefined;
    build2: BuildBundleMetricRecord | undefined;
    bundleDiff: BundleDiff[];
    metricDiff: MetricDiff[];
  }>;
}

/**
 * Bundlesテーブルの操作を定義するリポジトリインターフェース
 */
export interface BundleRepository {
  /**
   * バンドル情報を作成
   */
  create(buildId: number | bigint, bundle: BundleInfo): Promise<number | bigint>;

  /**
   * 複数のバンドル情報を一括作成
   */
  createMany(buildId: number | bigint, bundles: BundleInfo[]): Promise<void>;

  /**
   * ビルドIDに紐づくバンドルを取得
   */
  findByBuildId(buildId: number): Promise<BundleInfo[]>;

  /**
   * バンドル名でバンドルを検索
   */
  findByName(name: string, limit?: number): Promise<(BundleInfo & { buildId: number; })[]>;

  /**
   * 指定サイズ以上のバンドルを取得
   */
  findLargeBundles(minSize: number, limit?: number): Promise<(BundleInfo & { buildId: number; })[]>;
}

/**
 * Metricsテーブルの操作を定義するリポジトリインターフェース
 */
export interface MetricRepository {
  /**
   * メトリクスを作成
   */
  create(buildId: number | bigint, metricName: string, value: number): Promise<number | bigint>;

  /**
   * 複数のメトリクスを一括作成
   */
  createMany(buildId: number | bigint, metrics: Array<{ name: string; value: number; }>): Promise<void>;

  /**
   * ビルドIDに紐づくメトリクスを取得
   */
  findByBuildId(buildId: number): Promise<Array<{ metricName: string; value: number; }>>;

  /**
   * 特定のメトリクスの履歴を取得
   */
  findMetricHistory(
    metricName: string,
    days?: number,
  ): Promise<Array<{ buildId: number; value: number; timestamp: string; }>>;

  /**
   * メトリクスの統計を取得
   */
  getMetricStats(metricName: string, days?: number): Promise<{
    average: number;
    min: number;
    max: number;
    count: number;
  }>;
}

/**
 * Recommendationsテーブルの操作を定義するリポジトリインターフェース
 */
export interface RecommendationRepository {
  /**
   * 推奨事項を作成
   */
  create(buildId: number | bigint, type: string, message: string, impact?: string): Promise<number | bigint>;

  /**
   * 複数の推奨事項を一括作成
   */
  createMany(buildId: number | bigint, recommendations: string[], type?: string): Promise<void>;

  /**
   * ビルドIDに紐づく推奨事項を取得
   */
  findByBuildId(buildId: number): Promise<string[]>;

  /**
   * タイプ別の推奨事項を取得
   */
  findByType(type: string, limit?: number): Promise<Array<{ buildId: number; message: string; impact: string; }>>;

  /**
   * よく出現する推奨事項を取得
   */
  findFrequentRecommendations(days?: number, limit?: number): Promise<Array<{ message: string; count: number; }>>;
}

/**
 * 全リポジトリを統合するユニットオブワーク
 */
export interface Repository {
  builds: BuildRepository;
  bundles: BundleRepository;
  metrics: MetricRepository;
  recommendations: RecommendationRepository;

  /**
   * 初期化処理
   */
  initSchema(): Promise<void>;

  /**
   * データベースをクリーンアップ
   */
  cleanAll(): Promise<void>;

  /**
   * トランザクションを開始
   */
  beginTransaction(): Promise<void>;

  /**
   * トランザクションをコミット
   */
  commit(): Promise<void>;

  /**
   * トランザクションをロールバック
   */
  rollback(): Promise<void>;

  /**
   * 接続を閉じる
   */
  close(): Promise<void>;
}
