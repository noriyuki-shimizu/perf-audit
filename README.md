# Performance Audit CLI Tool

フロントエンド・SSR(Server-Side Rendering)アプリケーションのパフォーマンスを継続的に監視・分析し、パフォーマンス劣化を防ぐためのCLIツール。

## 特徴

- ✅ クライアント・サーバーサイドバンドルの自動監視（SSR対応）
- ✅ 個別・統合パフォーマンスバジェットチェック
- ✅ Lighthouse統合によるWebパフォーマンス測定
- ✅ SQLiteベースの履歴管理とトレンド分析
- ✅ JSON/HTML形式の詳細レポート生成
- ✅ CI/CD統合（GitHub Actions、GitLab CI対応）
- ✅ Webpack, Vite, Rollup等の主要バンドラー対応
- ✅ Webダッシュボードによるビジュアライゼーション

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

### 2. バンドル分析（SSR対応）

```bash
perf-audit analyze [オプション]
```

オプション:

- `--format <type>`: 出力形式 (json, html, console) [デフォルト: console]
- `--details`: 詳細分析を表示

設定ファイルの `analysis.target` で解析対象を制御できます：

- `'client'`: クライアントサイドバンドルのみ
- `'server'`: サーバーサイドバンドルのみ
- `'both'`: クライアント・サーバー両方（デフォルト）

#### 出力例（SSR対応）

```
🎯 Performance Audit Report
═══════════════════════════════════════════

📦🖥️ Client & Server Analysis

📦 Client Bundles:
├─ main.js:      125.3KB (gzip: 42.1KB) ⚠️ +5.2KB
├─ vendor.js:    89.2KB  (gzip: 28.3KB) ✅
└─ Client Total: 214.3KB (gzip: 70.4KB)

🖥️ Server Bundles:
├─ server.js:    180.4KB (gzip: 58.2KB) ✅ -2.1KB
├─ vendor.js:    145.6KB (gzip: 42.8KB) ✅
└─ Server Total: 326.0KB (gzip: 101.0KB)

📊 Overall Total:
└─ Combined Total: 540.3KB (gzip: 171.4KB)

💡 Recommendations:
- [Client] Consider code splitting for large bundles: main.js
- [Server] Review server dependencies for optimization

✅ All checks passed! (2024-01-15 19:30:00)
```

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
- `--format <type>`: 出力形式 (json, console) [デフォルト: console]

例:

```bash
perf-audit history --days 14 --format json
```

### 6. Webダッシュボード（SSR対応）

```bash
perf-audit dashboard [オプション]
```

オプション:

- `--port <n>`: ダッシュボードのポート番号 [デフォルト: 3000]
- `--host <host>`: バインドするホスト [デフォルト: localhost]
- `--open`: ブラウザを自動で開く

パフォーマンスデータを視覚化するWebダッシュボードを起動します。

**主な機能:**

- クライアント・サーバーバンドル別の可視化
- 個別および統合トレンドグラフ
- パフォーマンスバジェット状況の表示
- 履歴データのインタラクティブな分析
- レスポンシブ対応のダッシュボードUI

### 8. データクリーンアップ

```bash
perf-audit clean [オプション]
```

オプション:

- `--days <n>`: N日より古いデータを削除 [デフォルト: 30]
- `--all`: すべてのパフォーマンスデータを削除
- `--force`: 確認プロンプトをスキップ

パフォーマンスデータとレポートをクリーンアップします。

## SSR（Server-Side Rendering）対応

Performance Audit CLI ToolはSSRアプリケーションにも対応しており、クライアントサイドとサーバーサイドのバンドルを個別に、または統合して解析できます。

### SSRアプリケーションの設定

1. **設定ファイルの準備**: `perf-audit.config.js` でクライアント・サーバーの設定を個別に定義
2. **解析対象の選択**: `analysis.target` で解析対象を選択（`client`, `server`, `both`）
3. **バジェット管理**: クライアント・サーバー別に異なるパフォーマンスバジェットを設定

### 使用例

```bash
# クライアント・サーバー両方を解析
perf-audit analyze

# クライアントサイドのみ解析
# config.analysis.target = 'client'
perf-audit analyze

# サーバーサイドのみ解析
# config.analysis.target = 'server'
perf-audit analyze
```

### ダッシュボードでの可視化

Webダッシュボードでは以下の機能を提供：

- **個別表示**: クライアント・サーバーバンドルを別々に表示
- **統合表示**: 総合的なパフォーマンス状況を表示
- **トレンド分析**: 時系列でのバンドルサイズ変化を追跡
- **バジェット管理**: 個別バジェットの遵守状況を監視

## 設定

`perf-audit.config.js` でプロジェクトに合わせて設定をカスタマイズできます。

#### クライアントサイド設定 (`project.client`)

| 項目         | 型     | デフォルト | 説明                         |
| ------------ | ------ | ---------- | ---------------------------- |
| `outputPath` | string | `'./dist'` | クライアント出力ディレクトリ |

#### サーバーサイド設定 (`project.server`)

| 項目         | 型     | デフォルト        | 説明                     |
| ------------ | ------ | ----------------- | ------------------------ |
| `outputPath` | string | `'./dist/server'` | サーバー出力ディレクトリ |

### パフォーマンスバジェット設定 (`budgets`) - SSR対応

#### クライアントサイドバジェット (`budgets.client.bundles`)

| 項目           | 型     | 説明                                     | 例                                   |
| -------------- | ------ | ---------------------------------------- | ------------------------------------ |
| `main`         | object | クライアントメインバンドルのサイズ制限   | `{ max: '150KB', warning: '120KB' }` |
| `vendor`       | object | クライアントベンダーバンドルのサイズ制限 | `{ max: '100KB', warning: '80KB' }`  |
| `total`        | object | クライアント全バンドルの合計サイズ制限   | `{ max: '500KB', warning: '400KB' }` |
| `[カスタム名]` | object | 任意のバンドル名のサイズ制限             | `{ max: '50KB', warning: '40KB' }`   |

#### サーバーサイドバジェット (`budgets.server.bundles`)

| 項目           | 型     | 説明                                 | 例                                   |
| -------------- | ------ | ------------------------------------ | ------------------------------------ |
| `main`         | object | サーバーメインバンドルのサイズ制限   | `{ max: '200KB', warning: '150KB' }` |
| `vendor`       | object | サーバーベンダーバンドルのサイズ制限 | `{ max: '150KB', warning: '120KB' }` |
| `total`        | object | サーバー全バンドルの合計サイズ制限   | `{ max: '800KB', warning: '600KB' }` |
| `[カスタム名]` | object | 任意のバンドル名のサイズ制限         | `{ max: '80KB', warning: '60KB' }`   |

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

### 分析設定 (`analysis`) - SSR対応

| 項目          | 型       | デフォルト                         | 説明                                  |
| ------------- | -------- | ---------------------------------- | ------------------------------------- |
| `target`      | string   | `'both'`                           | 解析対象 (`client`, `server`, `both`) |
| `gzip`        | boolean  | `true`                             | gzip圧縮サイズを計測するか            |
| `ignorePaths` | string[] | `['**/*.test.js', '**/*.spec.js']` | 分析から除外するファイルパターン      |

### レポート設定 (`reports`)

| 項目        | 型       | デフォルト                    | 説明                     |
| ----------- | -------- | ----------------------------- | ------------------------ |
| `formats`   | string[] | `['console', 'json', 'html']` | 利用可能な出力形式       |
| `outputDir` | string   | `'./performance-reports'`     | レポート出力ディレクトリ |

### 設定例（SSR対応）

```javascript
export default {
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

### 事前準備

[volta](https://docs.volta.sh/guide/getting-started) のインストール必須

### 各種コマンド

```bash
# 依存関係のインストール
npm ci

# ビルド
npm run build

# 起動
npm start

# テスト実行
npm test

# Lint
npm run lint

# Type Check
npm run typecheck

# Format Check
npm run format:check
```

### 開発エディタ

VSCode

## ライセンス

MIT
