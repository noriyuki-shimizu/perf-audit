import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../src/core/notification-service.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('../../../src/utils/size.ts', () => ({
  formatSize: vi.fn((size: number) => `${Math.round(size / 1024)}KB`),
}));

// Mock fetch
global.fetch = vi.fn();

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      const appConfig = {
        notifications: {
          slack: { webhook: 'https://slack.webhook' },
        },
      };

      const service = new NotificationService(appConfig);

      expect(service).toBeInstanceOf(NotificationService);
    });

    it('should handle missing notification config', () => {
      const appConfig = {};

      const service = new NotificationService(appConfig);

      expect(service).toBeInstanceOf(NotificationService);
    });
  });

  describe('sendPerformanceAlert', () => {
    it('should send slack notification when configured', async () => {
      const appConfig = {
        notifications: {
          slack: {
            webhook: 'https://hooks.slack.com/webhook',
            channel: '#performance',
          },
        },
      };

      const service = new NotificationService(appConfig);
      const alert = {
        type: 'regression' as const,
        changes: [
          {
            name: 'main.js',
            previousSize: 100000,
            currentSize: 120000,
            delta: 20000,
            percentage: 20,
            isRegression: true,
          },
        ],
        result: {
          timestamp: '2023-01-01T00:00:00.000Z',
          bundles: [],
          recommendations: [],
          budgetStatus: 'warning' as const,
          analysisType: 'client' as const,
        },
      };

      await service.sendPerformanceAlert(alert);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Performance Regression Detected'),
        }),
      );
    });

    it('should handle notification failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const appConfig = {
        notifications: {
          slack: { webhook: 'https://invalid.webhook' },
        },
      };

      const service = new NotificationService(appConfig);
      const alert = {
        type: 'regression' as const,
        changes: [],
        result: {
          timestamp: '2023-01-01T00:00:00.000Z',
          bundles: [],
          recommendations: [],
          budgetStatus: 'ok' as const,
          analysisType: 'client' as const,
        },
      };

      await service.sendPerformanceAlert(alert);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send Slack notification:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should not send notifications when not configured', async () => {
      const appConfig = {};
      const service = new NotificationService(appConfig);

      const alert = {
        type: 'improvement' as const,
        changes: [],
        result: {
          timestamp: '2023-01-01T00:00:00.000Z',
          bundles: [],
          recommendations: [],
          budgetStatus: 'ok' as const,
          analysisType: 'client' as const,
        },
      };

      await service.sendPerformanceAlert(alert);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
