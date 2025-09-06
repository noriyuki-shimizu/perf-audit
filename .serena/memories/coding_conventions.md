# コーディング規約とスタイルガイド

## 基本原則

- **言語**: 必ず英語で記述
- **YAGNI**: You Aren't Gonna Need It - 今必要じゃない機能は作らない
- **DRY**: Don't Repeat Yourself - 同じコードを繰り返さない
- **KISS**: Keep It Simple Stupid - シンプルに保つ

## TypeScript規約

### 命名規則

- **関数名**: `lowerCamelCase`、動詞から始める（例: `createUser`, `updateTask`）
- **変数名**: `lowerCamelCase`、名詞から始める（例: `userData`, `taskList`）
- **型名**: `UpperCamelCase`（例: `UserData`, `TaskList`）
- **ファイル名**: `lowerCamelCase`（例: `userService.ts`）
- **ディレクトリ名**: `kebab-case`（例: `user-service`）

### コード規則

- **変数宣言**: `const` を優先、`var`/`let` は極力避ける
- **文字列**: テンプレートリテラル使用、性能要件があれば `+` 連結
- **クラス**: 禁止、関数型で記述
- **`any`型**: 禁止、必要時は `unknown` を使用
- **`for in`**: 禁止
- **三項演算子**: ネスト禁止

### ファイル配置規則

- **型定義**: `src/types/*.ts`
- **ユーティリティ**: `src/utils/*.ts`
- **定数**: `src/constants/*.ts`（汎用的なもの）
- **関数**: `src/functions/*.ts`（汎用ステートレス関数）
- **外部API**: `infrastructures/` （該当なし）

### JSDoc規則

- **変数・型**: 1行JSDoc `/** 説明 */`
- **関数**: 複数行JSDoc

```typescript
/**
 * 関数の説明
 * @param arg - 引数の説明
 * @returns 戻り値の説明
 */
const func = (arg: string): boolean => {/* ... */};
```

## フォーマット設定（dprint）

- **インデント**: スペース2個
- **行幅**: 120文字
- **クォート**: シングルクォート優先
- **セミコロン**: 必須
- **カンマ**: 複数行のみ末尾付与

## ESLint設定

- TypeScript推奨設定有効
- `@typescript-eslint/no-unused-vars`: エラー
- `@typescript-eslint/no-explicit-any`: 警告
- `prefer-const`: エラー
- `no-console`: 無効（CLIツールのため）
