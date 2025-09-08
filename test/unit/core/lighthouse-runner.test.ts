import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LighthouseRunner } from '../../../src/core/lighthouse-runner.ts';
import type { LighthouseOptions } from '../../../src/types/lighthouse.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('chrome-launcher', () => ({
  launch: vi.fn().mockResolvedValue({ port: 9222, kill: vi.fn() }),
}));

vi.mock('lighthouse', () => ({
  default: vi.fn().mockResolvedValue({
    lhr: {
      categories: {
        performance: { score: 0.85 },
        accessibility: { score: 0.95 },
        'best-practices': { score: 0.92 },
        seo: { score: 0.88 },
      },
      audits: {
        'first-contentful-paint': { numericValue: 1500 },
        'largest-contentful-paint': { numericValue: 2200 },
        'cumulative-layout-shift': { numericValue: 0.05 },
        'interactive': { numericValue: 3000 },
      },
    },
  }),
}));

describe('LighthouseRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runAudit', () => {
    it('should run lighthouse audit for desktop', async () => {
      const runner = new LighthouseRunner();
      const options: LighthouseOptions = {
        url: 'https://example.com',
        device: 'desktop',
        throttling: true,
      };

      const result = await runner.runAudit(options);

      expect(result).toEqual({
        performance: 85,
        accessibility: 95,
        bestPractices: 92,
        seo: 88,
        metrics: {
          fcp: 1500,
          lcp: 2200,
          cls: 0.05,
          tti: 3000,
        },
      });
    });

    it('should run lighthouse audit for mobile', async () => {
      const runner = new LighthouseRunner();
      const options: LighthouseOptions = {
        url: 'https://example.com',
        device: 'mobile',
        throttling: false,
      };

      const result = await runner.runAudit(options);

      expect(result.performance).toBe(85);
    });

    it('should validate URL correctly', () => {
      expect(LighthouseRunner.validateUrl('https://example.com')).toBe(true);
      expect(LighthouseRunner.validateUrl('http://example.com')).toBe(true);
      expect(LighthouseRunner.validateUrl('invalid-url')).toBe(false);
      expect(LighthouseRunner.validateUrl('')).toBe(false);
    });
  });
});
