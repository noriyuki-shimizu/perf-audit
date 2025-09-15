import type { AuditResult, BundleInfo } from './config.ts';

/** Command options interfaces */
export interface AnalyzeOptions {
  format: 'json' | 'html' | 'console';
  compare?: string;
  details?: boolean;
}

/** Budget options interface */
export interface BudgetOptions {
  format: 'json' | 'console';
}

/** Clean options interface */
export interface CleanOptions {
  force?: boolean;
  days?: number;
  all?: boolean;
}

/** Dashboard options interface */
export interface DashboardOptions {
  port: number;
  host: string;
  open?: boolean;
}

/** History options interface */
export interface HistoryOptions {
  days: number;
  format: 'console' | 'json';
}

/** Lighthouse options interface */
export interface CommandLighthouseOptions {
  device: 'mobile' | 'desktop';
  throttling: boolean;
  format: 'json' | 'console';
}

/** Watch options interface */
export interface WatchOptions {
  interval?: number;
  notify?: boolean;
  silent?: boolean;
}

/** Analyze command types */
export interface AnalysisContext {
  config: unknown;
}

/** Bundle analysis context */
export interface BundleAnalysisContext {
  outputPath: string;
}

/** After bundle analysis context */
export interface AfterBundleAnalysisContext {
  bundles: BundleInfo[];
}

/** After full analysis context */
export interface AfterAnalysisContext {
  result: AuditResult;
}

/** Before report generation context */
export interface BeforeReportContext {
  result: AuditResult;
  format: string;
}

/** After report generation context */
export interface AfterReportContext {
  result: AuditResult;
  outputPath: string;
}

/** Error context for handling errors in commands */
export interface ErrorContext {
  error: Error;
  context: string;
}

/** Watch command types */
export interface BundleChange {
  /** Bundle name */
  name: string;
  /** Previous bundle size in bytes */
  previousSize: number;
  /** Current bundle size in bytes */
  currentSize: number;
  /** Size change delta in bytes */
  delta: number;
  /** Percentage change */
  percentage: number;
  /** Whether this change is a regression */
  isRegression: boolean;
}

/** Performance comparison interface */
export interface PerformanceComparison {
  /** Array of significant bundle changes */
  significantChanges: BundleChange[];
  /** Whether any regressions were detected */
  hasRegression: boolean;
  /** Whether any improvements were detected */
  hasImprovement: boolean;
  /** Total size change across all bundles */
  totalSizeChange: number;
}

/** Watch command state interface */
export interface WatchState {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Timestamp of last analysis */
  lastAnalysisTime: number;
  /** Baseline audit result for comparison */
  baseline: AuditResult | null;
}

/** Dashboard command types */
export interface Build {
  id: number;
  timestamp: string;
  bundles: BundleInfo[];
}

/** Trend query parameters */
export interface TrendQuery {
  days: number;
  startDate: string;
  endDate: string;
}

/** Trend data interface */
export interface TrendData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill: boolean;
    borderDash?: number[];
  }>;
}

/** Bundle statistics interface */
export interface BundleStats {
  totalSize: number;
  averageSize: number;
  bundleCount: number;
  formattedTotalSize?: string;
  formattedAverageSize?: string;
}

/** Dashboard statistics interface */
export interface DashboardStats {
  totalBuilds: number;
  averageSize: number;
  lastBuildStatus: 'ok' | 'warning' | 'error';
  trendsCount: number;
  formattedAverageSize?: string;
  clientStats: BundleStats;
  serverStats: BundleStats;
}

/** Budget command types */
export type BudgetStatus = 'ok' | 'warning' | 'error';

/** Bundle type */
export type BundleType = 'client' | 'server' | 'both';

/** Budget JSON output interface */
export interface BudgetJsonOutput {
  passed: boolean;
  status: BudgetStatus;
  violations: BundleInfo[];
  timestamp: string;
}
