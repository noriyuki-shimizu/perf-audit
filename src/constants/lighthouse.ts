/** Lighthouse設定に関連する定数 */

/** モバイル設定 */
export const MOBILE_CONFIG = {
  /** ネットワーク遅延（ミリ秒） */
  RTT_MS: 150,
  /** スループット（Kbps） */
  THROUGHPUT_KBPS: 1638,
  /** CPU減速倍数 */
  CPU_SLOWDOWN_MULTIPLIER: 4,
  /** 画面幅 */
  SCREEN_WIDTH: 360,
  /** 画面高さ */
  SCREEN_HEIGHT: 640,
  /** デバイススケール係数 */
  DEVICE_SCALE_FACTOR: 2.625,
} as const;

/** デスクトップ設定 */
export const DESKTOP_CONFIG = {
  /** ネットワーク遅延（ミリ秒） */
  RTT_MS: 40,
  /** スループット（Kbps） */
  THROUGHPUT_KBPS: 10240,
  /** CPU減速倍数 */
  CPU_SLOWDOWN_MULTIPLIER: 1,
  /** 画面幅 */
  SCREEN_WIDTH: 1350,
  /** 画面高さ */
  SCREEN_HEIGHT: 940,
  /** デバイススケール係数 */
  DEVICE_SCALE_FACTOR: 1,
} as const;

/** Chrome起動オプション */
export const CHROME_FLAGS = ['--headless'] as const;
