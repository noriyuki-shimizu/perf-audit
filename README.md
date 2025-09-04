# Performance Audit CLI Tool

フロントエンド開発におけるパフォーマンスを継続的に監視・分析し、パフォーマンス劣化を防ぐためのCLIツール。

## 特徴

- ✅ バンドルサイズの自動監視
- ✅ パフォーマンスバジェットチェック
- ✅ Lighthouse統合によるWebパフォーマンス測定
- ✅ SQLiteベースの履歴管理とトレンド分析
- ✅ JSON/HTML形式の詳細レポート生成
- ✅ CI/CD統合（GitHub Actions、GitLab CI対応）
- ✅ Webpack, Vite, Rollup等の主要バンドラー対応

## インストール

```bash
npm install -g perf-audit-cli
```

## 使い方

### 1. 初期化

```bash
perf-audit init
```

設定ファイル `perf-audit.config.js` が作成され、プロジェクトに合わせてカスタマイズできます。

### 2. バンドル分析

```bash
perf-audit analyze [オプション]
```

オプション:

- `--format <type>`: 出力形式 (json, html, console) [デフォルト: console]
- `--compare <branch>`: 指定したブランチと比較
- `--details`: 詳細分析を表示

### 3. パフォーマンスバジェットチェック

```bash
perf-audit budget [オプション]
```

オプション:

- `--format <type>`: 出力形式 (json, console) [デフォルト: console]

設定された閾値と比較し、CI向けの終了コードを返します。

### 4. Lighthouse監査

```bash
perf-audit lighthouse <url> [オプション]
```

オプション:

- `--device <type>`: デバイスタイプ (mobile, desktop) [デフォルト: mobile]
- `--no-throttling`: ネットワークスロットリングを無効化
- `--format <type>`: 出力形式 (json, console) [デフォルト: console]

例:

```bash
perf-audit lighthouse https://example.com --device desktop --format json
```

### 5. パフォーマンス履歴・トレンド

```bash
perf-audit history [オプション]
```

オプション:

- `--days <n>`: 表示する日数 [デフォルト: 30]
- `--metric <type>`: 特定のメトリクスのトレンドを表示
- `--format <type>`: 出力形式 (json, console) [デフォルト: console]

例:

```bash
perf-audit history --days 14 --metric size
```

### 6. リアルタイム監視

```bash
perf-audit watch [オプション]
```

オプション:

- `--interval <ms>`: デバウンス間隔（ミリ秒） [デフォルト: 1000]
- `--threshold <kb>`: サイズ変化の閾値（KB） [デフォルト: 5]
- `--notify`: 通知を有効化
- `--silent`: 出力の冗長性を削減

ファイルの変更を監視し、リアルタイムでパフォーマンス分析を実行します。

### 7. Webダッシュボード

```bash
perf-audit dashboard [オプション]
```

オプション:

- `--port <n>`: ダッシュボードのポート番号 [デフォルト: 3000]
- `--host <host>`: バインドするホスト [デフォルト: localhost]
- `--open`: ブラウザを自動で開く

パフォーマンスデータを視覚化するWebダッシュボードを起動します。

### 8. データクリーンアップ

```bash
perf-audit clean [オプション]
```

オプション:

- `--days <n>`: N日より古いデータを削除 [デフォルト: 30]
- `--all`: すべてのパフォーマンスデータを削除
- `--force`: 確認プロンプトをスキップ

パフォーマンスデータとレポートをクリーンアップします。

## 設定

`perf-audit.config.js` でプロジェクトに合わせて設定をカスタマイズできます。

### プロジェクト設定 (`project`)

| 項目         | 型     | デフォルト              | 説明                       | 選択肢                                             |
| ------------ | ------ | ----------------------- | -------------------------- | -------------------------------------------------- |
| `type`       | string | `'webpack'`             | バンドラータイプ           | `webpack`, `vite`, `rollup`, `rolldown`, `esbuild` |
| `configPath` | string | `'./webpack.config.js'` | バンドラー設定ファイルパス | ファイルパス                                       |
| `outputPath` | string | `'./dist'`              | ビルド出力ディレクトリ     | ディレクトリパス                                   |

### パフォーマンスバジェット設定 (`budgets`)

#### バンドルバジェット (`budgets.bundles`)

| 項目           | 型     | 説明                         | 例                                   |
| -------------- | ------ | ---------------------------- | ------------------------------------ |
| `main`         | object | メインバンドルのサイズ制限   | `{ max: '150KB', warning: '120KB' }` |
| `vendor`       | object | ベンダーバンドルのサイズ制限 | `{ max: '100KB', warning: '80KB' }`  |
| `total`        | object | 全バンドルの合計サイズ制限   | `{ max: '500KB', warning: '400KB' }` |
| `[カスタム名]` | object | 任意のバンドル名のサイズ制限 | `{ max: '50KB', warning: '40KB' }`   |

#### Lighthouseバジェット (`budgets.lighthouse`)

| 項目                  | 型     | 説明                           | 範囲  |
| --------------------- | ------ | ------------------------------ | ----- |
| `performance.min`     | number | パフォーマンススコアの最小値   | 0-100 |
| `performance.warning` | number | パフォーマンススコアの警告値   | 0-100 |
| `accessibility.min`   | number | アクセシビリティスコアの最小値 | 0-100 |
| `seo.min`             | number | SEOスコアの最小値              | 0-100 |

#### Core Web Vitals バジェット (`budgets.metrics`)

| 項目          | 型     | 単位 | 説明                              |
| ------------- | ------ | ---- | --------------------------------- |
| `fcp.max`     | number | ms   | First Contentful Paint の最大値   |
| `fcp.warning` | number | ms   | FCP の警告値                      |
| `lcp.max`     | number | ms   | Largest Contentful Paint の最大値 |
| `lcp.warning` | number | ms   | LCP の警告値                      |
| `cls.max`     | number | -    | Cumulative Layout Shift の最大値  |
| `cls.warning` | number | -    | CLS の警告値                      |
| `tti.max`     | number | ms   | Time to Interactive の最大値      |
| `tti.warning` | number | ms   | TTI の警告値                      |

### 分析設定 (`analysis`)

| 項目          | 型       | デフォルト                         | 説明                             |
| ------------- | -------- | ---------------------------------- | -------------------------------- |
| `gzip`        | boolean  | `true`                             | gzip圧縮サイズを計測するか       |
| `brotli`      | boolean  | `false`                            | brotli圧縮サイズを計測するか     |
| `sourceMaps`  | boolean  | `true`                             | ソースマップを分析するか         |
| `ignorePaths` | string[] | `['**/*.test.js', '**/*.spec.js']` | 分析から除外するファイルパターン |

### レポート設定 (`reports`)

| 項目        | 型       | デフォルト                    | 説明                     |
| ----------- | -------- | ----------------------------- | ------------------------ |
| `formats`   | string[] | `['console', 'json', 'html']` | 利用可能な出力形式       |
| `outputDir` | string   | `'./performance-reports'`     | レポート出力ディレクトリ |
| `retention` | number   | `30`                          | 履歴保持日数             |

### 通知設定 (`notifications`)

#### Slack通知 (`notifications.slack`)

| 項目        | 型     | 説明                                   |
| ----------- | ------ | -------------------------------------- |
| `webhook`   | string | SlackのWebhook URL（環境変数推奨）     |
| `channel`   | string | 通知先チャンネル                       |
| `threshold` | string | 通知レベル (`error`, `warning`, `all`) |

### 設定例

```javascript
export default {
  // プロジェクト設定
  project: {
    type: 'webpack',
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
    retention: 30,
  },

  // 通知設定
  notifications: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK,
      channel: '#performance',
      threshold: 'warning',
    },
  },
};
```

## CI/CD統合

```yaml
# GitHub Actions example
name: Performance Audit

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  performance-audit:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Install perf-audit-cli
        run: npm install -g .

      - name: Run bundle analysis
        run: |
          perf-audit analyze --format json > bundle-report.json
          perf-audit analyze --format html
        continue-on-error: true

      - name: Check performance budgets
        run: perf-audit budget --format json > budget-results.json

      - name: Upload performance reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: performance-reports
          path: |
            performance-reports/
            bundle-report.json
            budget-results.json

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');

            // Read budget results
            let budgetResults = {};
            try {
              budgetResults = JSON.parse(fs.readFileSync('budget-results.json', 'utf8'));
            } catch (e) {
              console.log('Could not read budget results');
              return;
            }

            // Generate comment
            const statusEmoji = {
              ok: '✅',
              warning: '⚠️',
              error: '❌'
            };

            const emoji = statusEmoji[budgetResults.status] || '❓';
            const status = budgetResults.status || 'unknown';

            let comment = `## 🎯 Performance Audit Results ${emoji}\n\n`;
            comment += `**Status:** ${status.toUpperCase()}\n`;
            comment += `**Timestamp:** ${budgetResults.timestamp}\n\n`;

            if (budgetResults.violations && budgetResults.violations.length > 0) {
              comment += `### ⚠️ Budget Violations\n\n`;
              comment += `| Bundle | Size | Status |\n`;
              comment += `|--------|------|--------|\n`;

              budgetResults.violations.forEach(violation => {
                const size = (violation.size / 1024).toFixed(1) + 'KB';
                comment += `| \`${violation.name}\` | ${size} | ${statusEmoji[violation.status]} ${violation.status} |\n`;
              });
              comment += `\n`;
            } else {
              comment += `### ✅ All budgets passed!\n\n`;
            }

            comment += `---\n`;
            comment += `Generated by perf-audit-cli | [View detailed reports](https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})\n`;

            // Post comment
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  lighthouse-audit:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    strategy:
      matrix:
        site:
          - url: "https://your-site.com"
            name: "Production"
          # Add more URLs as needed

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Install perf-audit-cli
        run: npm install -g .

      - name: Run Lighthouse audit (Mobile)
        run: |
          perf-audit lighthouse ${{ matrix.site.url }} --device mobile --format json > lighthouse-mobile-${{ matrix.site.name }}.json
        continue-on-error: true

      - name: Run Lighthouse audit (Desktop)
        run: |
          perf-audit lighthouse ${{ matrix.site.url }} --device desktop --format json > lighthouse-desktop-${{ matrix.site.name }}.json
        continue-on-error: true

      - name: Upload Lighthouse reports
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: lighthouse-reports-${{ matrix.site.name }}
          path: |
            lighthouse-*.json
            performance-reports/

  performance-history:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Install perf-audit-cli
        run: npm install -g .

      - name: Restore performance history
        uses: actions/cache@v4
        with:
          path: .perf-audit/
          key: perf-audit-${{ github.sha }}
          restore-keys: |
            perf-audit-

      - name: Generate performance history
        run: |
          perf-audit analyze
          perf-audit history --days 30 --format json > performance-history.json

      - name: Upload history
        uses: actions/upload-artifact@v4
        with:
          name: performance-history
          path: |
            performance-history.json
            .perf-audit/
```

終了コード:

- `0`: すべてのチェックが成功
- `1`: エラー（バジェット超過）
- `2`: 警告

## 開発

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# 開発モード
npm run dev

# テスト実行
npm test

# Lint
npm run lint
```

## ライセンス

MIT
