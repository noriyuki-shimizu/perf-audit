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

export interface ClientConfig {
  outputPath: string;
}

export interface ServerConfig {
  outputPath: string;
}

export interface ProjectConfig {
  client: ClientConfig;
  server: ServerConfig;
}

export interface BundleBudgetConfig {
  bundles: {
    [key: string]: BundleBudget;
  };
}

export interface BudgetConfig {
  client: BundleBudgetConfig;
  server: BundleBudgetConfig;
  metrics: {
    fcp: MetricBudget;
    lcp: MetricBudget;
    cls: MetricBudget;
    tti: MetricBudget;
  };
}

export interface AnalysisConfig {
  target: 'client' | 'server' | 'both';
  gzip: boolean;
  ignorePaths: string[];
}

export interface ReportConfig {
  formats: Array<'console' | 'json' | 'html'>;
  outputDir: string;
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
  type?: 'client' | 'server';
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
  analysisType: 'client' | 'server' | 'both';
}

export interface CIContext {
  isCI: boolean;
  provider: 'github' | 'gitlab' | 'jenkins' | 'unknown';
  branch?: string;
  commitHash?: string;
  pullRequestId?: string;
  buildNumber?: string;
}
