/** サーバー設定に関連する定数 */

/** デフォルトのポート番号 */
export const DEFAULT_PORT = 3000;

/** デフォルトのホスト名 */
export const DEFAULT_HOST = 'localhost';

/** デフォルトのCLIオプション値 */
export const DEFAULT_CLI_OPTIONS = {
  /** デフォルトの履歴表示日数 */
  HISTORY_DAYS: '30',
  /** デフォルトの監視間隔（ミリ秒） */
  WATCH_INTERVAL: '1000',
  /** デフォルトのサイズ変更閾値（KB） */
  WATCH_THRESHOLD: '5',
  /** デフォルトの出力フォーマット */
  OUTPUT_FORMAT: 'console',
  /** デフォルトのLighthouseデバイス */
  LIGHTHOUSE_DEVICE: 'mobile',
} as const;
