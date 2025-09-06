import type { AuditResult } from './config.ts';

/**
 * Performance alert interface
 */
export interface PerformanceAlert {
  type: 'regression' | 'improvement' | 'budget_exceeded';
  changes?: Array<{
    name: string;
    delta: number;
    percentage: number;
    isRegression: boolean;
  }>;
  result: AuditResult;
  message?: string;
}

/**
 * Notification configuration interface
 */
export interface NotificationConfig {
  slack?: {
    webhook?: string;
    channel?: string;
    username?: string;
  };
  discord?: {
    webhook?: string;
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
}
