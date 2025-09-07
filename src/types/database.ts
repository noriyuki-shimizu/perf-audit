/** ビルドレコード */
export interface BuildRecord {
  id: number;
  timestamp: string;
  branch: string;
  commitHash: string;
  url?: string;
  device?: string;
}

/** バンドルレコード */
export interface BundleRecord {
  id: number;
  buildId: number;
  name: string;
  size: number;
  gzipSize?: number;
}

/** メトリクスレコード */
export interface MetricRecord {
  id: number;
  buildId: number;
  metricName: string;
  value: number;
}

/** 推奨レコード */
export interface RecommendationRecord {
  id: number;
  buildId: number;
  type: string;
  message: string;
  impact: string;
}

/** トレンドデータ */
export interface TrendData {
  date: string;
  totalSize: number;
  gzipSize?: number;
  performanceScore?: number;
  fcp?: number;
  lcp?: number;
  cls?: number;
  tti?: number;
}
