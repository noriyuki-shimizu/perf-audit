import { describe, expect, it } from 'vitest';
import {
  calculateDelta,
  formatDelta,
  formatSize,
  formatSizeString,
  getStatus,
  parseSize,
} from '../../../src/utils/size.ts';

describe('parseSize', () => {
  it.each([
    { input: '100B', expected: 100 },
    { input: '1KB', expected: 1024 },
    { input: '2.5KB', expected: 2560 },
    { input: '1MB', expected: 1048576 },
    { input: '1.5MB', expected: 1572864 },
    { input: '1GB', expected: 1073741824 },
  ])('should parse $input to $expected bytes', ({ input, expected }) => {
    expect(parseSize(input)).toBe(expected);
  });

  it.each([
    { input: '100b' }, // lowercase
    { input: '2.5kb' }, // lowercase
    { input: '1mb' }, // lowercase
  ])('should parse $input case-insensitively', ({ input }) => {
    expect(() => parseSize(input)).not.toThrow();
  });

  it.each([
    { input: 'invalid' },
    { input: '100' },
    { input: 'KB100' },
    { input: '100XB' },
  ])('should throw error for invalid format: $input', ({ input }) => {
    expect(() => parseSize(input)).toThrow(`Invalid size format: ${input}`);
  });
});

describe('formatSize', () => {
  it.each([
    { bytes: 0, expected: 0 },
    { bytes: 100, expected: 100 },
    { bytes: 1024, expected: 1.0 },
    { bytes: 2560, expected: 2.5 },
    { bytes: 1048576, expected: 1.0 }, // 1MB
    { bytes: 1572864, expected: 1.5 }, // 1.5MB
  ])('should format $bytes bytes to $expected', ({ bytes, expected }) => {
    expect(formatSize(bytes)).toBe(expected);
  });

  it('should handle negative bytes', () => {
    expect(formatSize(-100)).toBe(0);
  });

  it('should respect decimals parameter', () => {
    expect(formatSize(2560, 0)).toBe(3); // 2.5KB rounded to 3
  });

  it('should handle negative decimals', () => {
    expect(formatSize(2560, -1)).toBe(3); // Treated as 0 decimals
  });
});

describe('formatSizeString', () => {
  it.each([
    { bytes: 0, expected: '0B' },
    { bytes: 100, expected: '100B' },
    { bytes: 1024, expected: '1KB' },
    { bytes: 2560, expected: '2.5KB' },
    { bytes: 1048576, expected: '1MB' },
    { bytes: 1572864, expected: '1.5MB' },
    { bytes: 1073741824, expected: '1GB' },
  ])('should format $bytes bytes to "$expected"', ({ bytes, expected }) => {
    expect(formatSizeString(bytes)).toBe(expected);
  });

  it('should handle negative bytes', () => {
    expect(formatSizeString(-100)).toBe('0B');
  });

  it('should respect decimals parameter', () => {
    expect(formatSizeString(2560, 0)).toBe('3KB');
  });

  it('should handle negative decimals', () => {
    expect(formatSizeString(2560, -1)).toBe('3KB');
  });

  it('should handle large numbers with TB unit', () => {
    const terabyte = 1024 * 1024 * 1024 * 1024;
    expect(formatSizeString(terabyte)).toBe('1TB');
  });
});

describe('calculateDelta', () => {
  it.each([
    { current: 100, previous: 50, expected: 50 },
    { current: 50, previous: 100, expected: -50 },
    { current: 100, previous: 100, expected: 0 },
  ])('should calculate delta between $current and $previous as $expected', ({ current, previous, expected }) => {
    expect(calculateDelta(current, previous)).toBe(expected);
  });
});

describe('formatDelta', () => {
  it.each([
    { delta: 1024, expected: '+1KB' },
    { delta: -1024, expected: '-1KB' },
    { delta: 0, expected: '+0B' },
  ])('should format delta $delta as "$expected"', ({ delta, expected }) => {
    expect(formatDelta(delta)).toBe(expected);
  });
});

describe('getStatus', () => {
  it.each([
    { current: 50, warning: 80, max: 100, expected: 'ok' },
    { current: 80, warning: 80, max: 100, expected: 'warning' },
    { current: 90, warning: 80, max: 100, expected: 'warning' },
    { current: 100, warning: 80, max: 100, expected: 'error' },
    { current: 120, warning: 80, max: 100, expected: 'error' },
  ])(
    'should return "$expected" for current: $current, warning: $warning, max: $max',
    ({ current, warning, max, expected }) => {
      expect(getStatus(current, warning, max)).toBe(expected);
    },
  );
});
