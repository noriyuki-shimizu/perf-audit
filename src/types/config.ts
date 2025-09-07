/** バンドルのサイズ制限設定 */
export interface BundleBudget {
  max: string;
  warning: string;
}

/** Lighthouseのスコア制限設定 */
export interface LighthouseBudget {
  min: number;
  warning?: number;
}

/** パフォーマンスメトリクスの制限設定 */
export interface MetricBudget {
  max: number;
  warning: number;
}

/** クライアントサイドの設定 */
export interface ClientConfig {
  outputPath: string;
}

/** サーバーサイドの設定 */
export interface ServerConfig {
  outputPath: string;
}

/** プロジェクトの設定 */
export interface ProjectConfig {
  client: ClientConfig;
  server: ServerConfig;
}

/** バンドルバジェットの設定 */
export interface BundleBudgetConfig {
  bundles: {
    [key: string]: BundleBudget;
  };
}

/** バジェット全体の設定 */
export interface BudgetConfig {
  client: BundleBudgetConfig;
  server: BundleBudgetConfig;
  lighthouse: {
    performance: LighthouseBudget;
    accessibility?: LighthouseBudget;
    bestPractices?: LighthouseBudget;
    seo?: LighthouseBudget;
  };
  metrics: {
    fcp: MetricBudget;
    lcp: MetricBudget;
    cls: MetricBudget;
    tti: MetricBudget;
  };
}

/** 解析の設定 */
export interface AnalysisConfig {
  target: 'client' | 'server' | 'both';
  gzip: boolean;
  ignorePaths: string[];
}

/** レポート出力の設定 */
export interface ReportConfig {
  formats: Array<'console' | 'json' | 'html'>;
  outputDir: string;
}

/** 通知の設定 */
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

/** パフォーマンス監査の全体設定 */
export interface PerfAuditConfig {
  project: ProjectConfig;
  budgets: BudgetConfig;
  analysis: AnalysisConfig;
  reports: ReportConfig;
  notifications?: NotificationConfig;
  plugins?: import('./plugin.ts').PluginConfig[];
}

/** バンドルの情報 */
export interface BundleInfo {
  name: string;
  size: number;
  gzipSize?: number;
  delta?: number;
  status: 'ok' | 'warning' | 'error';
  type?: 'client' | 'server';
}

/** パフォーマンス測定結果 */
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

/** 監査結果 */
export interface AuditResult {
  timestamp: string;
  bundles: BundleInfo[];
  lighthouse?: PerformanceMetrics;
  recommendations: string[];
  budgetStatus: 'ok' | 'warning' | 'error';
  analysisType: 'client' | 'server' | 'both';
}

/** CI環境のコンテキスト情報 */
export interface CIContext {
  isCI: boolean;
  provider: 'github' | 'gitlab' | 'jenkins' | 'unknown';
  branch?: string;
  commitHash?: string;
  pullRequestId?: string;
  buildNumber?: string;
}
