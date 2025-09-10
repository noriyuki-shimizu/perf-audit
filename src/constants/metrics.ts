/** パフォーマンスメトリクスに関連する定数 */

/** デフォルトのメトリクス制限値 */
export const DEFAULT_METRICS = {
  /** First Contentful Paint（ミリ秒） */
  FCP: {
    max: 1500,
    warning: 1000,
  },
  /** Largest Contentful Paint（ミリ秒） */
  LCP: {
    max: 2500,
    warning: 2000,
  },
  /** Cumulative Layout Shift */
  CLS: {
    max: 0.1,
    warning: 0.05,
  },
  /** Time to Interactive（ミリ秒） */
  TTI: {
    max: 3500,
    warning: 3000,
  },
} as const;

/** デフォルトのLighthouseスコア制限値 */
export const DEFAULT_LIGHTHOUSE_SCORES = {
  /** パフォーマンススコア */
  PERFORMANCE: {
    min: 90,
    warning: 95,
  },
  /** アクセシビリティスコア */
  ACCESSIBILITY: {
    min: 90,
    warning: 95,
  },
  /** ベストプラクティススコア */
  BEST_PRACTICES: {
    min: 90,
    warning: 95,
  },
  /** SEOスコア */
  SEO: {
    min: 90,
    warning: 95,
  },
} as const;
