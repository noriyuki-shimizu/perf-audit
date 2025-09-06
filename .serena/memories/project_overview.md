# perf-audit-cli プロジェクト概要

## プロジェクト目的

フロントエンド開発におけるパフォーマンスを継続的に監視・分析し、パフォーマンス劣化を防ぐためのCLIツール。

## 技術スタック

- **言語**: TypeScript (ES2022)
- **モジュールシステム**: ES Modules (Node.js ESM)
- **ビルドツール**: TypeScript Compiler (tsc)
- **テストフレームワーク**: Vitest
- **リンター**: ESLint with TypeScript ESLint
- **フォーマッター**: dprint
- **データベース**: SQLite (better-sqlite3)
- **CLI フレームワーク**: Commander.js
- **ランタイム**: Node.js 18+ (推奨: 22.19.0)

## 主要機能

- バンドルサイズの自動監視
- パフォーマンスバジェットチェック
- Lighthouse統合によるWebパフォーマンス測定
- SQLiteベースの履歴管理とトレンド分析
- JSON/HTML形式の詳細レポート生成
- CI/CD統合（GitHub Actions、GitLab CI対応）
- リアルタイム監視機能
- Webダッシュボード

## プロジェクト情報

- **バージョン**: 0.0.3
- **作者**: Noriyuki Shimizu
- **ライセンス**: MIT
- **リポジトリ**: https://github.com/noriyuki-shimizu/perf-audit
