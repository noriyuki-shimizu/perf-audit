# Performance Audit CLI Tool

## 要件定義書

`../RDD.md` を参照すること

## 会話におけるガイドライン

- 常に日本語で会話する

## コーディング原則 (Coding Principles)

実装の詳細に関する最も重要なセクションです。
コードを記述する前に、 `.github/instructions` ディレクトリにある指示ファイルを**必ず**参照してください。これらのドキュメントには、コードベースの一貫性、品質、保守性を維持するために不可欠な、私たちのコーディング規約が定義されています。

- **General Rules**: `.github/instructions/general.instructions.md`
- **Testing**: `.github/instructions/testing.instructions.md`
- **TypeScript**: `.github/instructions/typescript.instructions.md`

## タスク完了後

下記コマンドを実行する。

```bash
npm run typecheck && npm run lint && npm run format:check && npm test
```

実行した際、エラーになった場合は、エラーがなくなるまで修正を続けてください。
