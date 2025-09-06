export interface BundleBudget {
  max: string;
  warning: string;
}

export interface LighthouseBudget {
  min: number;
  warning?: number;
}

export interface MetricBudget {
  max: number;
  warning: number;
}

export interface ProjectConfig {
  type: 'webpack' | 'vite' | 'rollup' | 'rolldown' | 'esbuild';
  configPath: string;
  outputPath: string;
}

export interface BudgetConfig {
  bundles: {
    [key: string]: BundleBudget;
  };
  lighthouse: {
    performance: LighthouseBudget;
    accessibility: LighthouseBudget;
    seo: LighthouseBudget;
  };
  metrics: {
    fcp: MetricBudget;
    lcp: MetricBudget;
    cls: MetricBudget;
    tti: MetricBudget;
  };
}

export interface AnalysisConfig {
  gzip: boolean;
  brotli: boolean;
  sourceMaps: boolean;
  ignorePaths: string[];
}

export interface ReportConfig {
  formats: Array<'console' | 'json' | 'html'>;
  outputDir: string;
  retention: number;
}

export interface NotificationConfig {
  slack?: {
    webhook: string;
    channel: string;
    username?: string;
  };
  discord?: {
    webhook: string;
  };
  email?: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    to: string[];
  };
  thresholds?: {
    sizeIncrease: number; // KB
    percentageIncrease: number; // %
    budgetViolation: boolean;
  };
}

export interface PerfAuditConfig {
  project: ProjectConfig;
  budgets: BudgetConfig;
  analysis: AnalysisConfig;
  reports: ReportConfig;
  notifications?: NotificationConfig;
  plugins?: import('./plugin.ts').PluginConfig[];
}

export interface BundleInfo {
  name: string;
  size: number;
  gzipSize?: number;
  delta?: number;
  status: 'ok' | 'warning' | 'error';
}

export interface PerformanceMetrics {
  performance: number;
  accessibility?: number;
  bestPractices?: number;
  seo?: number;
  metrics: {
    fcp: number;
    lcp: number;
    cls: number;
    tti: number;
  };
}

export interface AuditResult {
  timestamp: string;
  bundles: BundleInfo[];
  lighthouse?: PerformanceMetrics;
  recommendations: string[];
  budgetStatus: 'ok' | 'warning' | 'error';
}
