# Performance Audit CLI Tool - 要件定義書

## プロジェクト概要

フロントエンド・SSR(Server-Side Rendering)アプリケーションのパフォーマンスを継続的に監視・分析し、パフォーマンス劣化を防ぐためのCLIツール。

## 目的

- ビルドサイズとランタイムパフォーマンスの自動監視
- パフォーマンス問題の早期発見と改善提案
- CI/CDパイプラインでの自動チェック
- チーム全体でのパフォーマンス基準の共有

## 技術要件

### 必須要件

- Node.js 18以上対応
- TypeScriptで実装
- CLIフレームワーク: Commander.js または Yargs
- 対応バンドラー: Webpack 5, Vite, Rollup, Rolldown, esbuild
- パッケージマネージャー: npm, yarn, pnpm対応

### 依存ライブラリ候補

- lighthouse (Lighthouse統合)
- webpack-bundle-analyzer (バンドル分析)
- gzip-size (圧縮サイズ計算)
- chalk (ターミナル出力の装飾)
- ora (スピナー表示)
- inquirer (対話式インターフェース)

## 機能要件

### 1. コアコマンド

#### `perf-audit init`

- 設定ファイル(perf-audit.config.js)の生成
- .gitignoreへの追加
- 初期ベースライン測定

#### `perf-audit analyze [options]`

- バンドルサイズ分析（クライアント・サーバー両対応）
- チャンク別サイズ表示
- 前回ビルドとの差分表示
- SSRアプリケーション対応
- オプション:
  - `--format <type>`: 出力形式 (json, html, console)
  - `--details`: 詳細分析モード

#### `perf-audit lighthouse <url> [options]`

- Lighthouse実行とスコア表示
- メトリクス: Performance, Accessibility, Best Practices, SEO
- オプション:
  - `--device <type>`: mobile/desktop
  - `--throttling`: ネットワークスロットリング有効/無効

#### `perf-audit budget [options]`

- パフォーマンスバジェットチェック
- 設定ファイルの閾値と比較
- CI向け終了コード制御

#### `perf-audit history [options]`

- 履歴データの表示
- トレンドグラフ生成
- オプション:
  - `--days <n>`: 表示期間
  - `--format <type>`: フォーマット (console / format)

#### `perf-audit clean [options]`

- パフォーマンスデータのクリーンアップ
- データベース、レポート、キャッシュの削除
- オプション:
  - `--days <n>`: N日より古いデータを削除（デフォルト: 30）
  - `--all`: 全データを削除
  - `--force`: 確認プロンプトをスキップ

#### `perf-audit watch`

- ファイル監視モード
- リアルタイムサイズ計算
- 増分表示

#### `perf-audit dashboard`

- Webダッシュボード起動
- クライアント・サーバー別のトータルバンドルサイズを可視化
- analyzeを実行した日付ごとで線グラフを表示
- クライアント・サーバーで別々で線グラフを表示
- 日付で絞り込みができるフィルター機能を搭載
- 履歴データのトレンド表示
- インタラクティブなグラフとチャート

### 2. 設定ファイル仕様

```javascript
// perf-audit.config.js
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
  // 通知設定
  notifications: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK,
      channel: '#performance',
      threshold: 'warning', // error, warning, all
    },
  },
};
```

### 3. 出力仕様

#### コンソール出力例（SSR対応）

```
🎯 Performance Audit Report
═══════════════════════════════════════════

📦🖥️ Client & Server Analysis

📦 Client Bundles:
├─ main.js:      125.3KB (gzip: 42.1KB) ⚠️ +5.2KB
├─ vendor.js:    89.2KB  (gzip: 28.3KB) ✅
├─ styles.css:   15.6KB  (gzip: 4.2KB)  ✅
└─ Client Total: 230.1KB (gzip: 74.6KB)

🖥️ Server Bundles:
├─ server.js:    180.4KB (gzip: 58.2KB) ✅ -2.1KB
├─ vendor.js:    145.6KB (gzip: 42.8KB) ✅
└─ Server Total: 326.0KB (gzip: 101.0KB)

📊 Overall Total:
└─ Combined Total: 556.1KB (gzip: 175.6KB)

📊 Performance Metrics (Mobile)
├─ Performance Score: 92/100 ✅
├─ FCP: 1.2s ✅
├─ LCP: 2.3s ⚠️ (budget: 2.0s)
├─ CLS: 0.02 ✅
└─ TTI: 3.2s ✅

💡 Recommendations:
- [Client] Consider code splitting for large bundles: main.js
- [Server] Review server dependencies for optimization
- Optimize images in /assets/hero/ (potential -50KB)

📈 Trend (last 7 days):
Client bundle size: ↑ 5.2%
Server bundle size: ↓ 1.1%
Performance: ↓ 2 points

✅ All checks passed! (2024-01-15 19:30:00)
```

#### JSON出力構造（SSR対応）

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "analysisType": "both",
  "bundles": [
    {
      "name": "main.js",
      "type": "client",
      "size": 125300,
      "gzipSize": 42100,
      "delta": 5200,
      "status": "warning"
    },
    {
      "name": "server.js",
      "type": "server",
      "size": 180400,
      "gzipSize": 58200,
      "delta": -2100,
      "status": "ok"
    }
  ],
  "lighthouse": {
    "performance": 92,
    "metrics": {
      "fcp": 1200,
      "lcp": 2300,
      "cls": 0.02,
      "tti": 3200
    }
  },
  "recommendations": [
    "[Client] Consider code splitting for large bundles: main.js",
    "[Server] Review server dependencies for optimization"
  ],
  "budgetStatus": "warning"
}
```

### 4. データストレージ

- SQLite データベースで履歴管理
- `.perf-audit/` ディレクトリに保存
- スキーマ:
  - builds (id, timestamp, branch, commit_hash)
  - bundles (build_id, name, size, gzip_size)
  - metrics (build_id, metric_name, value)
  - recommendations (build_id, type, message, impact)

#### データクリーンアップ機能

**コマンド**: `perf-audit clean [options]`

**オプション**:

- `--days <n>`: 指定日数より古いデータを削除（デフォルト: 30日）
- `--all`: 全てのパフォーマンスデータを削除
- `--force`: 確認プロンプトをスキップ

**削除対象**:

1. データベース内の古いビルド記録
2. レポートファイル（JSON/HTML）
3. キャッシュディレクトリの一時ファイル

**使用例**:

```bash
# 30日より古いデータを削除（確認あり）
perf-audit clean

# 60日より古いデータを削除
perf-audit clean --days 60

# 全データを削除（確認あり）
perf-audit clean --all

# 全データを強制削除（確認なし）
perf-audit clean --all --force
```

**安全機能**:

- デフォルトで削除前に確認プロンプトを表示
- 削除されたファイル数とサイズを報告
- データベースのバックアップ推奨メッセージ

## 非機能要件

### パフォーマンス

- 分析実行時間: 大規模プロジェクトでも30秒以内
- メモリ使用量: 最大500MB

### 拡張性

- プラグインアーキテクチャ
- カスタムレポーター対応
- カスタムルール追加可能

### エラーハンドリング

- 明確なエラーメッセージ
- デバッグモード ( `--verbose` )
- 部分的な失敗でも継続実行

## 実装優先順位

### Phase 1 (MVP)

1. `analyze` コマンド (バンドルサイズ分析)
2. `budget` コマンド (閾値チェック)
3. 基本的な設定ファイル対応
4. コンソール出力

### Phase 2

1. `lighthouse` 統合
2. 履歴管理とトレンド表示
3. JSON/HTML レポート生成
4. CI/CD 統合機能

### Phase 3

1. `watch` モード
2. プラグインシステム
3. 通知機能 (Slack等)
4. Webダッシュボード

## テスト要件

- 単体テスト: Vitest
- 統合テスト: 実際のプロジェクトでの動作確認
- テストカバレッジ: 80%以上

## ドキュメント要件

- README.md: インストールと基本使用方法
- API ドキュメント: 全コマンドとオプション
- 設定ガイド: 詳細な設定例
- トラブルシューティングガイド

## 成功基準

- 主要バンドラー (Webpack, Vite) での動作確認
- パフォーマンス問題の検出率 90%以上
- 誤検知率 5%以下
- ユーザビリティテストでの満足度 80%以上
