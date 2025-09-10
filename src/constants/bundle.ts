/** バンドル分析に関連する定数 */

/** 大きなクライアントバンドルの閾値（150KB） */
export const LARGE_CLIENT_BUNDLE_THRESHOLD = 150 * 1024;

/** 小さなチャンクの閾値（10KB） */
export const SMALL_CHUNK_THRESHOLD = 10 * 1024;

/** 大きなサーバーバンドルの閾値（200KB） */
export const LARGE_SERVER_BUNDLE_THRESHOLD = 200 * 1024;

/** 重いサーバーバンドルの閾値（100KB） */
export const HEAVY_SERVER_BUNDLE_THRESHOLD = 100 * 1024;

/** 推奨事項を出すための最小小チャンク数 */
export const MIN_SMALL_CHUNKS_FOR_RECOMMENDATION = 3;

/** 最小サイズ変更閾値（バイト単位） */
export const MIN_SIZE_CHANGE_THRESHOLD = 1024;

/** 最小パーセンテージ変更閾値（%） */
export const MIN_PERCENTAGE_CHANGE_THRESHOLD = 5;

/** サイズ単位の変換倍数 */
export const SIZE_UNITS = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
} as const;

/** バイトとキロバイトの変換定数 */
export const BYTES_PER_KB = 1024;
