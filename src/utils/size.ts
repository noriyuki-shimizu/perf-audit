/**
 * ユーティリティ関数群
 * @param sizeString - サイズ文字列（例: '150KB', '2MB'）
 * @returns バイト数
 */
export function parseSize(sizeString: string): number {
  const units: { [key: string]: number; } = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
  };

  const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeString}`);
  }

  const [, value, unit] = match;
  const multiplier = units[unit.toUpperCase()] || 1;

  return Math.round(parseFloat(value) * multiplier);
}

/**
 * サイズの正規化
 * @param bytes - バイト数
 * @param decimals - 小数点以下の桁数（デフォルトは1）
 * @returns 正規化されたサイズ
 */
export function normalizeSize(bytes: number, decimals: number = 1): number {
  if (bytes <= 0) return 0;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
}

/**
 * サイズのフォーマット
 * @param bytes - バイト数
 * @param decimals - 小数点以下の桁数（デフォルトは1）
 * @returns フォーマットされたサイズ文字列
 */
export function formatSize(bytes: number, decimals: number = 1): string {
  if (bytes <= 0) return '0B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
}

/**
 * 差分を計算
 * @param current - 現在の値
 * @param previous - 前の値
 * @returns 差分
 */
export function calculateDelta(current: number, previous: number): number {
  return current - previous;
}

/**
 * 差分をフォーマット
 * @param delta - 差分
 * @returns フォーマットされた差分文字列（例: '+15KB', '-200B'）
 */
export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '-';
  const absoluteDelta = Math.abs(delta);
  return `${sign}${formatSize(absoluteDelta)}`;
}

/**
 * ステータスを取得
 * @param current - 現在の値
 * @param warning - 警告の閾値
 * @param max - 最大の閾値
 * @returns ステータス
 */
export function getStatus(current: number, warning: number, max: number): 'ok' | 'warning' | 'error' {
  if (current >= max) return 'error';
  if (current >= warning) return 'warning';
  return 'ok';
}
