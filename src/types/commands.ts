import type { AuditResult, BundleInfo } from './config.ts';

/**
 * Command options interfaces
 */
export interface AnalyzeOptions {
  format: 'json' | 'html' | 'console';
  compare?: string;
  details?: boolean;
}

export interface BudgetOptions {
  format: 'json' | 'console';
}

export interface CleanOptions {
  force?: boolean;
  days?: number;
  all?: boolean;
}

export interface DashboardOptions {
  port: number;
  host: string;
  open?: boolean;
}

export interface HistoryOptions {
  days: number;
  metric?: string;
  format: 'console' | 'json';
}

export interface CommandLighthouseOptions {
  device: 'mobile' | 'desktop';
  throttling: boolean;
  format: 'json' | 'console';
}

export interface WatchOptions {
  interval?: number;
  threshold?: number;
  notify?: boolean;
  silent?: boolean;
}

/**
 * Analyze command types
 */
export interface AnalysisContext {
  config: unknown;
}

export interface BundleAnalysisContext {
  outputPath: string;
}

export interface AfterBundleAnalysisContext {
  bundles: BundleInfo[];
}

export interface AfterAnalysisContext {
  result: AuditResult;
}

export interface BeforeReportContext {
  result: AuditResult;
  format: string;
}

export interface AfterReportContext {
  result: AuditResult;
  outputPath: string;
}

export interface ErrorContext {
  error: Error;
  context: string;
}

/**
 * Watch command types
 */
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

export interface WatchState {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Timestamp of last analysis */
  lastAnalysisTime: number;
  /** Baseline audit result for comparison */
  baseline: AuditResult | null;
}

/**
 * Dashboard command types
 */
export interface Build {
  id: number;
  timestamp: string;
  bundles: BundleInfo[];
}

export interface TrendQuery {
  days: number;
  startDate: string;
  endDate: string;
}

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

export interface BundleStats {
  totalSize: number;
  averageSize: number;
  bundleCount: number;
  formattedTotalSize?: string;
  formattedAverageSize?: string;
}

export interface DashboardStats {
  totalBuilds: number;
  averageSize: number;
  lastBuildStatus: 'ok' | 'warning' | 'error';
  trendsCount: number;
  formattedAverageSize?: string;
  clientStats: BundleStats;
  serverStats: BundleStats;
}

/**
 * Budget command types
 */
export type BudgetStatus = 'ok' | 'warning' | 'error';
export type BundleType = 'client' | 'server' | 'both';

export interface BudgetJsonOutput {
  passed: boolean;
  status: BudgetStatus;
  violations: BundleInfo[];
  timestamp: string;
}


