/** データクリーンアップに関連する定数 */

/** デフォルトの保持期間（日数） */
export const DEFAULT_RETENTION_DAYS = 30;

/** キャッシュの保持期間（日数） */
export const CACHE_RETENTION_DAYS = 7;

/** 1日のミリ秒数 */
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** データベースファイルのパス */
export const DATABASE_PATH = '.perf-audit/performance.db';

/** キャッシュディレクトリのパス */
export const CACHE_DIRECTORY = '.perf-audit/cache';
