/** パフォーマンスバジェットに関連する定数 */

/** デフォルトのクライアントサイドバジェット */
export const DEFAULT_CLIENT_BUDGETS = {
  MAIN: { max: '150KB', warning: '120KB' },
  VENDOR: { max: '100KB', warning: '80KB' },
  TOTAL: { max: '500KB', warning: '400KB' },
} as const;

/** デフォルトのサーバーサイドバジェット */
export const DEFAULT_SERVER_BUDGETS = {
  MAIN: { max: '200KB', warning: '150KB' },
  VENDOR: { max: '150KB', warning: '120KB' },
  TOTAL: { max: '800KB', warning: '600KB' },
} as const;

/** 通知設定のデフォルト閾値 */
export const DEFAULT_NOTIFICATION_THRESHOLDS = {
  /** サイズ増加閾値（KB） */
  SIZE_INCREASE: 10,
  /** パーセンテージ増加閾値（%） */
  PERCENTAGE_INCREASE: 5,
  /** バジェット違反の通知設定 */
  BUDGET_VIOLATION: true,
} as const;
