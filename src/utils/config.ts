import fs from 'fs';
import path from 'path';
import { PerfAuditConfig } from '../types/config.ts';
import { Logger } from './logger.ts';

const DEFAULT_CONFIG: PerfAuditConfig = {
  project: {
    client: {
      outputPath: './dist',
    },
    server: {
      outputPath: './dist/server',
    },
  },
  budgets: {
    client: {
      bundles: {
        main: { max: '150KB', warning: '120KB' },
        vendor: { max: '100KB', warning: '80KB' },
        total: { max: '500KB', warning: '400KB' },
      },
    },
    server: {
      bundles: {
        main: { max: '200KB', warning: '150KB' },
        vendor: { max: '150KB', warning: '120KB' },
        total: { max: '800KB', warning: '600KB' },
      },
    },
    metrics: {
      fcp: { max: 1500, warning: 1000 },
      lcp: { max: 2500, warning: 2000 },
      cls: { max: 0.1, warning: 0.05 },
      tti: { max: 3500, warning: 3000 },
    },
  },
  analysis: {
    target: 'both',
    gzip: true,
    ignorePaths: ['**/*.test.js', '**/*.spec.js'],
  },
  reports: {
    formats: ['console', 'json', 'html'],
    outputDir: './performance-reports',
  },
};

export async function loadConfig(configPath?: string): Promise<PerfAuditConfig> {
  const defaultConfigPath = path.join(process.cwd(), 'perf-audit.config.js');
  const finalConfigPath = configPath || defaultConfigPath;

  try {
    if (fs.existsSync(finalConfigPath)) {
      // Dynamic import for ES modules
      const configModule = await import(path.resolve(finalConfigPath));
      const userConfig = configModule.default || configModule;

      // Merge with default config
      return mergeConfig(DEFAULT_CONFIG, userConfig);
    }
  } catch {
    Logger.warn(`Failed to load config file: ${finalConfigPath}`);
    Logger.warn('Using default configuration');
  }

  return DEFAULT_CONFIG;
}

function mergeConfig(defaultConfig: PerfAuditConfig, userConfig: Partial<PerfAuditConfig>): PerfAuditConfig {
  return {
    project: { ...defaultConfig.project, ...userConfig.project },
    budgets: {
      client: {
        bundles: { ...defaultConfig.budgets.client.bundles, ...userConfig.budgets?.client?.bundles },
      },
      server: {
        bundles: { ...defaultConfig.budgets.server.bundles, ...userConfig.budgets?.server?.bundles },
      },
      metrics: { ...defaultConfig.budgets.metrics, ...userConfig.budgets?.metrics },
    },
    analysis: { ...defaultConfig.analysis, ...userConfig.analysis },
    reports: { ...defaultConfig.reports, ...userConfig.reports },
    notifications: userConfig.notifications,
  };
}

export function generateConfigFile(outputPath: string = 'perf-audit.config.js'): void {
  const configContent = `export default {
  // プロジェクト設定
  project: {
    // クライアントサイドの設定
    client: {
      outputPath: './dist',
    },

    // サーバーサイドの設定（SSR対応）
    server: {
      outputPath: './dist/server',
    },
  },

  // パフォーマンスバジェット
  budgets: {
    // クライアントサイドバジェット
    client: {
      bundles: {
        main: { max: '150KB', warning: '120KB' },
        vendor: { max: '100KB', warning: '80KB' },
        total: { max: '500KB', warning: '400KB' },
      },
    },
    // サーバーサイドバジェット
    server: {
      bundles: {
        main: { max: '200KB', warning: '150KB' },
        vendor: { max: '150KB', warning: '120KB' },
        total: { max: '800KB', warning: '600KB' },
      },
    },
    // メトリクス設定（クライアントサイドのみ）
    metrics: {
      fcp: { max: 1500, warning: 1000 },
      lcp: { max: 2500, warning: 2000 },
      cls: { max: 0.1, warning: 0.05 },
      tti: { max: 3500, warning: 3000 },
    },
  },

  // 分析設定
  analysis: {
    // 解析対象の選択: 'client', 'server', 'both'
    target: 'both',
    gzip: true,
    ignorePaths: ['**/*.test.js', '**/*.spec.js'],
  },

  // レポート設定
  reports: {
    formats: ['console', 'json', 'html'],
    outputDir: './performance-reports',
  },

  // 通知設定
  notifications: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK,
      channel: '#performance',
      username: 'perf-audit-bot'
    },
    discord: {
      webhook: process.env.DISCORD_WEBHOOK
    },
    email: {
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      },
      from: 'performance@yourcompany.com',
      to: ['team@yourcompany.com']
    },
    thresholds: {
      sizeIncrease: 10, // KB
      percentageIncrease: 5, // %
      budgetViolation: true
    }
  },

  // プラグイン設定
  plugins: [
    { name: 'bundle-analyzer', enabled: true },
    { name: 'performance-tracker', enabled: true },
    { name: 'ci-reporter', enabled: true }
  ]
}
`;

  fs.writeFileSync(outputPath, configContent);
  Logger.success(`Configuration file created: ${outputPath}`);
}
