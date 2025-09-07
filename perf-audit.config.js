export default {
  // プロジェクト設定
  project: {
    // クライアントサイドの設定
    client: {
      outputPath: './dist',
    },

    // サーバーサイドの設定（SSR対応）
    server: {
      outputPath: './dist',
    },
  },

  // パフォーマンスバジェット
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
    target: 'server',
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
      threshold: 'warning', // error, warning, all
    },
  },
};
