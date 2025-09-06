# テストガイドライン

## テストフレームワーク

- **ユニットテスト**: Vitest (`.test.ts` ファイル)
- **カバレッジ**: @vitest/coverage-v8

## テスト記述ルール

### 基本ルール

- **1つの `it` につき 1つの `expect`** で結果を検証
- **`it.each`** を使って複数パラメータのテストを記述
- **テスト名**: 何をテストしているかが明確になるように記述
- **タイムアウト**: ファイル内に `vi.setConfig({ testTimeout: 100 });` を設定

### テストファイル配置

```
test/
├── unit/                  # ユニットテスト
├── integration/           # 統合テスト
└── test-data/             # テスト用データ
```

### 命名規則

- **テストファイル**: `*.test.ts`
- **テストスイート**: `describe('機能名', () => {})`
- **テストケース**: `it('should 期待する動作', () => {})`

### パラメータ化テストの例

```typescript
it.each([
  { input: 'value1', expected: 'result1' },
  { input: 'value2', expected: 'result2' },
])('should return $expected when input is $input', ({ input, expected }) => {
  expect(func(input)).toBe(expected);
});
```

### テスト実行コマンド

```bash
npm test              # 全テスト実行
npm run test:coverage # カバレッジ付き実行
```

## テスト対象

- **コマンド実装**: `src/commands/*.ts`
- **コア機能**: `src/core/*.ts`
- **ユーティリティ**: `src/utils/*.ts`
- **プラグイン**: `src/plugins/*.ts`

## モックとフィクスチャ

- **テスト用データ**: `test/test-data/` に配置
- **モック**: vitestの標準モック機能を使用
