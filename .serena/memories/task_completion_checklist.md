# タスク完了時チェックリスト

## 必須実行コマンド

タスク完了後、以下のコマンドを順番に実行し、エラーがなくなるまで修正を続ける：

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

## 各コマンドの詳細

### 1. TypeScript型チェック

```bash
npm run typecheck
```

- TypeScriptコンパイラによる型チェック
- エラーがある場合は修正必須

### 2. ESLint

```bash
npm run lint
```

- コード品質とスタイルチェック
- 自動修正可能な場合: `npm run lint:fix`

### 3. フォーマットチェック

```bash
npm run format:check
```

- dprint によるフォーマット確認
- 自動修正: `npm run format`

### 4. テスト実行

```bash
npm test
```

- Vitest によるユニットテスト実行
- 全テストがパスすることを確認

## チェックポイント

- [ ] TypeScript型エラーなし
- [ ] ESLintエラー・警告なし
- [ ] フォーマットエラーなし
- [ ] 全テストパス
- [ ] 新機能には対応するテストを追加
- [ ] JSDocによる適切なドキュメント化
- [ ] 不要なファイルの削除

## Git関連

- コミット前に上記チェックリストを完了
- コミットメッセージは英語で記述
- プルリクエスト作成時は CI が通ることを確認
