import fs from 'fs';
import path from 'path';
import { PerfAuditConfig } from '../types/config.ts';
import { Logger } from './logger.ts';

const DEFAULT_CONFIG: PerfAuditConfig = {
  project: {
    type: 'webpack',
    configPath: './webpack.config.js',
    outputPath: './dist',
  },
  budgets: {
    bundles: {
      main: { max: '150KB', warning: '120KB' },
      vendor: { max: '100KB', warning: '80KB' },
      total: { max: '500KB', warning: '400KB' },
    },
    lighthouse: {
      performance: { min: 90, warning: 95 },
      accessibility: { min: 95 },
      seo: { min: 90 },
    },
    metrics: {
      fcp: { max: 1500, warning: 1000 },
      lcp: { max: 2500, warning: 2000 },
      cls: { max: 0.1, warning: 0.05 },
      tti: { max: 3500, warning: 3000 },
    },
  },
  analysis: {
    gzip: true,
    brotli: false,
    sourceMaps: true,
    ignorePaths: ['**/*.test.js', '**/*.spec.js'],
  },
  reports: {
    formats: ['console', 'json', 'html'],
    outputDir: './performance-reports',
    retention: 30,
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
      bundles: { ...defaultConfig.budgets.bundles, ...userConfig.budgets?.bundles },
      lighthouse: { ...defaultConfig.budgets.lighthouse, ...userConfig.budgets?.lighthouse },
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
    type: 'webpack', // webpack, vite, rollup, rolldown, esbuild
    configPath: './webpack.config.js',
    outputPath: './dist'
  },

  // パフォーマンスバジェット
  budgets: {
    bundles: {
      main: { max: '150KB', warning: '120KB' },
      vendor: { max: '100KB', warning: '80KB' },
      total: { max: '500KB', warning: '400KB' }
    },
    lighthouse: {
      performance: { min: 90, warning: 95 },
      accessibility: { min: 95 },
      seo: { min: 90 }
    },
    metrics: {
      fcp: { max: 1500, warning: 1000 },
      lcp: { max: 2500, warning: 2000 },
      cls: { max: 0.1, warning: 0.05 },
      tti: { max: 3500, warning: 3000 }
    }
  },

  // 分析設定
  analysis: {
    gzip: true,
    brotli: false,
    sourceMaps: true,
    ignorePaths: ['**/*.test.js', '**/*.spec.js']
  },

  // レポート設定
  reports: {
    formats: ['console', 'json', 'html'],
    outputDir: './performance-reports',
    retention: 30 // 履歴保持日数
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
