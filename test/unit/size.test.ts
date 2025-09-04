import { describe, expect, it } from 'vitest';
import { formatSize } from '../../src/utils/size.js';

describe('Size Utils', () => {
  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(formatSize(0)).toBe('0B');
      expect(formatSize(512)).toBe('512B');
      expect(formatSize(1023)).toBe('1023B');
    });

    it('should format KB correctly', () => {
      expect(formatSize(1024)).toBe('1KB');
      expect(formatSize(1536)).toBe('1.5KB');
      expect(formatSize(2048)).toBe('2KB');
      expect(formatSize(102400)).toBe('100KB');
    });

    it('should format MB correctly', () => {
      expect(formatSize(1024 * 1024)).toBe('1MB');
      expect(formatSize(1024 * 1024 * 1.5)).toBe('1.5MB');
      expect(formatSize(1024 * 1024 * 10)).toBe('10MB');
    });

    it('should format GB correctly', () => {
      expect(formatSize(1024 * 1024 * 1024)).toBe('1GB');
      expect(formatSize(1024 * 1024 * 1024 * 2.5)).toBe('2.5GB');
    });

    it('should handle edge cases', () => {
      expect(formatSize(-1)).toBe('0B'); // Assuming negative numbers return 0B
      expect(formatSize(0)).toBe('0B');
    });

    it('should round to one decimal place', () => {
      expect(formatSize(1536)).toBe('1.5KB');
      expect(formatSize(1024 * 1.234)).toBe('1.2KB');
      expect(formatSize(1024 * 1.289)).toBe('1.3KB');
    });

    it('should handle very large numbers', () => {
      const veryLarge = 1024 * 1024 * 1024 * 1024 * 5; // 5TB
      expect(formatSize(veryLarge)).toMatch(/\d+(\.\d+)?TB/);
    });

    it('should handle decimal inputs', () => {
      expect(formatSize(1024.5)).toBe('1KB');
      expect(formatSize(1024.9)).toBe('1KB');
      expect(formatSize(1025)).toBe('1KB');
    });
  });
});
