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
