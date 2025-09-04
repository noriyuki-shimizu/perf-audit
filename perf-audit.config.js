export default {
  // プロジェクト設定
  project: {
    type: 'webpack', // webpack, vite, rollup, rolldown, esbuild
    configPath: './webpack.config.js',
    outputPath: './dist',
  },

  // パフォーマンスバジェット
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

  // 分析設定
  analysis: {
    gzip: true,
    brotli: false,
    sourceMaps: true,
    ignorePaths: ['**/*.test.js', '**/*.spec.js'],
  },

  // レポート設定
  reports: {
    formats: ['console', 'json', 'html'],
    outputDir: './performance-reports',
    retention: 30, // 履歴保持日数
  },

  // 通知設定
  notifications: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK,
      channel: '#performance',
      threshold: 'warning', // error, warning, all
    },
  },
};
