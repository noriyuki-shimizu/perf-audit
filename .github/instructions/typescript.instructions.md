---
applyTo: '**/*.ts'
---

## TypeScript コーディング規約

### 全体

- **ファイル名**: `lowerCamelCase` を使用
- **TypeScript のディレクトリ名**: `kebab-case` で作成
- **変数宣言**: var と let の使用は極力避け、const を使用
- **変数名と関数名**: `lowerCamelCase` で記述
- **型の命名**: `UpperCamelCase` で記述
- **文字列連結**: テンプレートリテラルを採用するが、パフォーマンスの観点で文字列連結が必要な場合は `+` を使用
- **`for in` の使用**: 禁止
- **三項演算子**: ネストするような書き方は禁止
- **class の使用**: 禁止とし、関数型で記述する
- **関数の引数や戻り値の型**: 明示的に指定する
- **any 型の使用**: 基本的に禁止だが、どうしても必要な場合は `unknown` を使用
- **ユニークなID**: `Branded Types` の使用を検討
- **変数や関数の引数、props の値**: `immutable` にする

### 定数

汎用的な定数は `src/constants/**.ts` に配置すること

例：

```ts:constants.ts
/** 定数の説明 */
export const MAX_NUM = 1_000
```

### 列挙型

汎用的な列挙型は `src/enums/**.ts` に配置すること

例：

```ts:enums.ts
/** 列挙型の説明 */
export const Item = {
  /** パラメータの説明 */
  PARAM: 'param',
} as const

/** 列挙型の説明 */
export type Item = (typeof Item)[keyof typeof Item]
```

### 外部API連携

`{rootDir}/infrastructures/` に定義をする
外部APIとの連携処理のみを記載すること

#### infrastructures ディレクトリ配下のルール

```
infrastructures
└── APIアーキテクチャスタイル（REST API / GraphQL / etc...）
    └── ドメイン名
        └── エンドポイント名
            ├── __mock__
            │   └── fixture.ts  // モックデータ
            ├── api.ts          // API連携の実装
            ├── index.ts        // バレルファイル
            └── types.ts        // 型定義ファイル
```

### ステートレスの関数

汎用的なステートレスの関数は `src/functions/**.ts` に配置すること

例：

```ts:functions.ts
/**
 * ステートレスの関数の説明
 */
export const func = () => {/* ... */}
```

### ユーティリティ

汎用的なユーティリティ関数は `src/utils/**.ts` に配置すること

例：

```ts:utils.ts
/**
 * ユーティリティの説明
 */
export const numUtil = () => {/* ... */}
```

### 型

汎用的な型定義は `src/types/**.ts` に配置すること

例：

```ts:types.ts
/** 型の説明 */
export type Num = number

/** 型の説明 */
export type Obj = {
  /** プロパティの説明 */
  param: string
}

/**
 * 関数の説明
 * @param arg - 引数の説明
 * @returns 戻り値の説明
 */
export type Func = (arg: string) => boolean
```

### JSDoc

Doc のルールは下記となる

#### 変数

`const` や `let` から始まる変数の定義は 1 行の JSDoc
`type` や `interface` の型定義は 1 行の JSDoc
`type` や `interface` のプロパティは 1 行の JSDoc
フォーマットは下記とする

```ts
/** 変数の説明 */
const arg = 'argument';
```

#### 関数

`const` から始まる関数(アロー関数も含め)は複数行の JSDoc
`function` から始まる関数は複数行の JSDoc
フォーマットは下記とする

```ts
/**
 * 関数の説明
 */
const func = (): void => {
  console.log('exec');
};
```
