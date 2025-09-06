/**
 * Database record interfaces
 */
export interface BuildRecord {
  id: number;
  timestamp: string;
  branch: string;
  commitHash: string;
  url?: string;
  device?: string;
}

export interface BundleRecord {
  id: number;
  buildId: number;
  name: string;
  size: number;
  gzipSize?: number;
}

export interface MetricRecord {
  id: number;
  buildId: number;
  metricName: string;
  value: number;
}

export interface RecommendationRecord {
  id: number;
  buildId: number;
  type: string;
  message: string;
  impact: string;
}

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
