---
applyTo: '**'
---

## 要件定義書

`../../RDD.md` を参照すること

## ディレクトリルール

### プロジェクト構造

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

### ルール

1. **src/**: TypeScript ソースコードのみ
2. **dist/**: ビルド成果物、手動編集禁止
3. **生成ファイル**: `performance-reports/`, `.perf-audit/`, `test/test-data/temp-*` は .gitignore で除外
4. **dashboard/**: `src/dashboard/public/` にある静的アセットは .gitignore で除外（生成ファイル）
5. **新機能**: 対応するテストを `test/` に必ず追加

## コーディング規約

### 命名

- **関数名**: 動詞から始める（例：`createUser`、`updateTask`）
- **変数名**: 名詞から始める（例：`userData`、`taskList`）
- **言語**: 必ず英語で記述する
- **ESLint**: 設定されたルールに従う

### コードスタイル

- **コメント**: 必要最小限に留める。自己説明的なコードを書く
- **型定義**: TypeScript を活用し、適切な型を定義する
- **エラーハンドリング**: 適切な例外処理を実装する
- **YAGNI（You Aren't Gonna Need It）**: 今必要じゃない機能は作らない
- **DRY（Don't Repeat Yourself）**: 同じコードを繰り返さない
- **KISS（Keep It Simple Stupid）**: シンプルに保つ

### パフォーマンス

- **基準**: パフォーマンスでは RAIL 準拠
