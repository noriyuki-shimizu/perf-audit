/** パスに関連する定数 */

/** デフォルトの設定ファイル名 */
export const DEFAULT_CONFIG_FILE = 'perf-audit.config.js';

/** デフォルトのクライアント出力パス */
export const DEFAULT_CLIENT_OUTPUT_PATH = './dist';

/** デフォルトのサーバー出力パス */
export const DEFAULT_SERVER_OUTPUT_PATH = './dist/server';

/** デフォルトのレポート出力ディレクトリ */
export const DEFAULT_REPORTS_OUTPUT_DIR = './performance-reports';

/** 無視するパスのデフォルト設定 */
export const DEFAULT_IGNORE_PATHS = ['**/*.test.js', '**/*.spec.js'] as const;
