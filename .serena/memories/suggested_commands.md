# 推奨コマンド一覧

## 開発用コマンド

### ビルド

```bash
npm run build          # TypeScript → JavaScript コンパイル
npm run dev            # 開発用ウォッチモード
```

### 品質チェック（タスク完了時に実行すべきコマンド）

```bash
npm run typecheck      # TypeScript型チェック
npm run lint           # ESLint実行
npm run format:check   # dprint フォーマットチェック
npm test              # Vitestでテスト実行
```

### フォーマット

```bash
npm run lint:fix       # ESLint自動修正
npm run format         # dprint自動フォーマット
```

### テスト

```bash
npm test               # 全テスト実行
npm run test:coverage  # カバレッジ付きテスト実行
```

## CLI実行コマンド

### 基本使用

```bash
npm start              # CLIを実行（node dist/bin/cli.js）
```

### 開発時テスト用

```bash
# 特定の設定で分析実行
PERF_AUDIT_CONFIG=test-perf-audit.config.js node dist/bin/cli.js analyze

# GitHub Actions環境をシミュレート
GITHUB_ACTIONS=true GITHUB_REF_NAME=main GITHUB_SHA=abc123 GITHUB_RUN_NUMBER=42 node dist/bin/cli.js analyze

# バジェットチェック（JSON出力）
GITHUB_ACTIONS=true GITHUB_REF_NAME=main GITHUB_SHA=abc123 GITHUB_RUN_NUMBER=42 PERF_AUDIT_CONFIG=test-perf-audit.config.js node dist/bin/cli.js budget --format json
```

## システムユーティリティ（macOS/Darwin）

```bash
ls                     # ファイル・ディレクトリ一覧
cd <path>              # ディレクトリ移動
grep -r "pattern" .    # 再帰的文字列検索（rg推奨）
find . -name "*.ts"    # ファイル検索
git status             # Git状態確認
git log --oneline      # Git履歴確認
```
