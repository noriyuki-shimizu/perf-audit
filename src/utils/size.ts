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

export function normalizeSize(bytes: number, decimals: number = 1): number {
  if (bytes <= 0) return 0;

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
}

export function formatSize(bytes: number, decimals: number = 1): string {
  if (bytes <= 0) return '0B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
}

export function calculateDelta(current: number, previous: number): number {
  return current - previous;
}

export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '-';
  const absoluteDelta = Math.abs(delta);
  return `${sign}${formatSize(absoluteDelta)}`;
}

export function getStatus(current: number, warning: number, max: number): 'ok' | 'warning' | 'error' {
  if (current >= max) return 'error';
  if (current >= warning) return 'warning';
  return 'ok';
}
