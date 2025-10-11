import fs from 'fs';
import path from 'path';
import {
  DEFAULT_CLIENT_BUDGETS,
  DEFAULT_CLIENT_OUTPUT_PATH,
  DEFAULT_CONFIG_FILE,
  DEFAULT_IGNORE_PATHS,
  DEFAULT_LIGHTHOUSE_SCORES,
  DEFAULT_METRICS,
  DEFAULT_REPORTS_OUTPUT_DIR,
  DEFAULT_SERVER_BUDGETS,
  DEFAULT_SERVER_OUTPUT_PATH,
} from '../constants/index.ts';
import { PerfAuditConfig } from '../types/config.ts';
import { Logger } from './logger.ts';

/** デフォルト設定 */
const DEFAULT_CONFIG: PerfAuditConfig = {
  project: {
    client: {
      outputPath: DEFAULT_CLIENT_OUTPUT_PATH,
    },
    server: {
      outputPath: DEFAULT_SERVER_OUTPUT_PATH,
    },
  },
  budgets: {
    client: {
      bundles: {
        main: DEFAULT_CLIENT_BUDGETS.MAIN,
        vendor: DEFAULT_CLIENT_BUDGETS.VENDOR,
        total: DEFAULT_CLIENT_BUDGETS.TOTAL,
      },
    },
    server: {
      bundles: {
        main: DEFAULT_SERVER_BUDGETS.MAIN,
        vendor: DEFAULT_SERVER_BUDGETS.VENDOR,
        total: DEFAULT_SERVER_BUDGETS.TOTAL,
      },
    },
    lighthouse: {
      performance: DEFAULT_LIGHTHOUSE_SCORES.PERFORMANCE,
      accessibility: DEFAULT_LIGHTHOUSE_SCORES.ACCESSIBILITY,
      bestPractices: DEFAULT_LIGHTHOUSE_SCORES.BEST_PRACTICES,
      seo: DEFAULT_LIGHTHOUSE_SCORES.SEO,
    },
    metrics: {
      fcp: DEFAULT_METRICS.FCP,
      lcp: DEFAULT_METRICS.LCP,
      cls: DEFAULT_METRICS.CLS,
      tti: DEFAULT_METRICS.TTI,
    },
  },
  analysis: {
    target: 'both',
    gzip: true,
    ignorePaths: [...DEFAULT_IGNORE_PATHS],
  },
  reports: {
    formats: ['console', 'json', 'html'],
    outputDir: DEFAULT_REPORTS_OUTPUT_DIR,
  },
};

/**
 * Load configuration from file or use default
 * @param configPath - Optional path to the configuration file
 * @returns Promise that resolves to the loaded configuration object
 */
export async function loadConfig(configPath?: string): Promise<PerfAuditConfig> {
  const configFilePath = process.env.PERF_AUDIT_CONFIG_FILE ?? DEFAULT_CONFIG_FILE;
  const defaultConfigPath = path.join(process.cwd(), configFilePath);
  const finalConfigPath = configPath ?? defaultConfigPath;

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

/**
 * Merge user configuration with default settings
 * @param defaultConfig Default configuration object
 * @param userConfig User-defined configuration object
 * @returns Merged configuration object
 */
function mergeConfig(defaultConfig: PerfAuditConfig, userConfig: Partial<PerfAuditConfig>): PerfAuditConfig {
  const mergeLighthouseBudget = () => {
    if (defaultConfig.budgets?.lighthouse !== undefined) return defaultConfig.budgets.lighthouse;
    if (userConfig.budgets?.lighthouse !== undefined) return userConfig.budgets.lighthouse;
    return undefined;
  };
  return {
    project: { ...defaultConfig.project, ...userConfig.project },
    budgets: {
      client: {
        bundles: { ...defaultConfig.budgets.client.bundles, ...userConfig.budgets?.client?.bundles },
      },
      server: {
        bundles: { ...defaultConfig.budgets.server.bundles, ...userConfig.budgets?.server?.bundles },
      },
      lighthouse: mergeLighthouseBudget(),
      metrics: { ...defaultConfig.budgets.metrics, ...userConfig.budgets?.metrics },
    },
    analysis: { ...defaultConfig.analysis, ...userConfig.analysis },
    reports: { ...defaultConfig.reports, ...userConfig.reports },
  };
}

/**
 * Generate a sample configuration file
 * @param outputPath - 出力先のパス（デフォルトは 'perf-audit.config.js'）
 */
export function generateConfigFile(outputPath: string = DEFAULT_CONFIG_FILE): void {
  const configContent = `export default {
  // プロジェクト設定
  project: {
    // クライアントサイドの設定
    client: {
      outputPath: './dist/client',
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
