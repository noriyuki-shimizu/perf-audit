# コードベース構造

## ディレクトリ構成

```
perf-audit/
├── .claude/                    # Claude Code 関連ファイル
│   └── doc/                   # プロジェクト文書
├── .github/                   # GitHub Actions、Issue templates等
│   └── instructions/          # Claude用プロジェクト指示書
├── src/                       # ソースコード
│   ├── bin/                   # CLI エントリポイント
│   ├── commands/              # CLI コマンド実装
│   ├── core/                  # コア機能（分析エンジン、DB等）
│   ├── types/                 # TypeScript 型定義
│   ├── utils/                 # ユーティリティ関数
│   ├── plugins/               # プラグインシステム
│   └── dashboard/             # ダッシュボード静的アセット
├── test/                      # テストファイル
│   ├── unit/                  # ユニットテスト
│   ├── integration/           # 統合テスト
│   └── test-data/             # テスト用データ
├── dist/                      # ビルド出力 (TypeScript → JavaScript)
├── performance-reports/       # 生成されたレポート（.gitignoreで除外）
└── .perf-audit/              # CLI実行時データベース（.gitignoreで除外）
```

## 主要ファイル

- **エントリポイント**: `src/bin/cli.ts`
- **コマンド**: `src/commands/*.ts` (analyze, budget, lighthouse, etc.)
- **コア機能**: `src/core/*.ts` (database, bundle-analyzer, lighthouse-runner, etc.)
- **ユーティリティ**: `src/utils/*.ts` (logger, config, reporter, etc.)
- **型定義**: `src/types/*.ts` (config, package)

## 設定ファイル

- **TypeScript**: `tsconfig.json`
- **ESLint**: `eslint.config.js`
- **dprint**: `dprint.json`
- **パッケージ管理**: `package.json`

## 無視ファイル

- **ビルド成果物**: `dist/`
- **生成レポート**: `performance-reports/`
- **実行時DB**: `.perf-audit/`
- **テスト一時ファイル**: `test/test-data/temp-*`

## 新機能追加時のルール

1. 対応するテストを `test/` に必ず追加
2. TypeScript型定義を適切に設定
3. ESLint・dprintルールに従う
4. JSDocで適切にドキュメント化
