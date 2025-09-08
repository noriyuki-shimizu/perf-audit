import type { AuditResult, BundleInfo, PerfAuditConfig, PerformanceMetrics } from './config.ts';

/** Plugin lifecycle hooks */
export type PluginHook =
  | 'beforeAnalysis'
  | 'afterAnalysis'
  | 'beforeBundleAnalysis'
  | 'afterBundleAnalysis'
  | 'beforeLighthouse'
  | 'afterLighthouse'
  | 'beforeReport'
  | 'afterReport'
  | 'onError'
  | 'onNotification';

/** Plugin context passed to each hook */
export interface PluginContext {
  config: PerfAuditConfig;
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  emit: (event: string, ...args: unknown[]) => void;
  store: Map<string, string | string[] | TrendAnalysis | CISummary>; // Plugin-specific data store
}

/** Data passed to different hooks */
export interface HookData {
  beforeAnalysis?: { config: PerfAuditConfig; };
  afterAnalysis?: { result: AuditResult; };
  beforeBundleAnalysis?: { outputPath: string; };
  afterBundleAnalysis?: { bundles: BundleInfo[]; };
  beforeLighthouse?: { url: string; options: unknown; };
  afterLighthouse?: { metrics: PerformanceMetrics; };
  beforeReport?: { result: AuditResult; format: string; };
  afterReport?: { result: AuditResult; outputPath: string; };
  onError?: { error: Error; context: string; };
  onNotification?: { type: string; data: unknown; };
}

/** Plugin interface */
export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  hooks: {
    [K in PluginHook]?: (context: PluginContext, data: HookData[K]) => Promise<void> | void;
  };
  install?: (context: PluginContext) => Promise<void> | void;
  uninstall?: (context: PluginContext) => Promise<void> | void;
}

/** Plugin configuration */
export interface PluginConfig {
  name: string;
  enabled: boolean;
}

/** Performance tracking related types */
export interface PerformanceSnapshot {
  timestamp: string;
  totalSize: number;
  totalGzipSize: number;
  bundleCount: number;
  budgetStatus: string;
  lighthouse?: PerformanceMetrics;
}

/** Summary of trend analysis results, including size changes, bundle count changes, alerts, and recommendations. */
export interface TrendAnalysis {
  sizeIncrease: boolean;
  sizeIncreasePercent: number;
  bundleCountChange: number;
  alerts: string[];
  recommendations: string[];
}

/** CI Reporter types */
export interface CISummary {
  status: 'success' | 'warning' | 'error';
  totalSize: string;
  totalGzipSize: string;
  bundleCount: number;
  violations: Array<{
    name: string;
    size: string;
    status: string;
    budget?: string;
    difference?: string;
  }>;
  improvements: Array<{
    name: string;
    description: string;
  }>;
  performanceScore?: number;
  url?: string;
  details?: string;
}
