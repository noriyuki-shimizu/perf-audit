import * as chromeLauncher from 'chrome-launcher';
import type { Result } from 'lighthouse';
import lighthouse from 'lighthouse';
import { CHROME_FLAGS, DESKTOP_CONFIG, MOBILE_CONFIG } from '../constants/index.ts';
import type { PerformanceMetrics } from '../types/config.ts';
import type { LighthouseConfig, LighthouseOptions } from '../types/lighthouse.ts';

export class LighthouseRunner {
  private static getDesktopConfig(): LighthouseConfig {
    return {
      extends: 'lighthouse:default',
      settings: {
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: DESKTOP_CONFIG.RTT_MS,
          throughputKbps: DESKTOP_CONFIG.THROUGHPUT_KBPS,
          cpuSlowdownMultiplier: DESKTOP_CONFIG.CPU_SLOWDOWN_MULTIPLIER,
        },
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: DESKTOP_CONFIG.SCREEN_WIDTH,
          height: DESKTOP_CONFIG.SCREEN_HEIGHT,
          deviceScaleFactor: DESKTOP_CONFIG.DEVICE_SCALE_FACTOR,
          disabled: false,
        },
      },
    };
  }

  private static getMobileConfig(): LighthouseConfig {
    return {
      extends: 'lighthouse:default',
      settings: {
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: MOBILE_CONFIG.RTT_MS,
          throughputKbps: MOBILE_CONFIG.THROUGHPUT_KBPS,
          cpuSlowdownMultiplier: MOBILE_CONFIG.CPU_SLOWDOWN_MULTIPLIER,
        },
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: MOBILE_CONFIG.SCREEN_WIDTH,
          height: MOBILE_CONFIG.SCREEN_HEIGHT,
          deviceScaleFactor: MOBILE_CONFIG.DEVICE_SCALE_FACTOR,
          disabled: false,
        },
      },
    };
  }

  async runAudit(options: LighthouseOptions): Promise<PerformanceMetrics & { rawResult?: Result; }> {
    const chrome = await chromeLauncher.launch({ chromeFlags: [...CHROME_FLAGS] });

    try {
      const config = options.device === 'desktop'
        ? LighthouseRunner.getDesktopConfig()
        : LighthouseRunner.getMobileConfig();

      // Disable throttling if requested
      if (!options.throttling) {
        config.settings.throttlingMethod = 'provided';
        config.settings.throttling = undefined;
      }

      const runnerResult = await lighthouse(options.url, {
        port: chrome.port,
        logLevel: 'error',
      }, config);

      if (!runnerResult) {
        throw new Error('Lighthouse audit failed');
      }

      const { lhr } = runnerResult;

      // Extract key metrics
      const metrics = this.extractMetrics(lhr);

      return {
        ...metrics,
        rawResult: options.outputFormat === 'json' ? lhr : undefined,
      };
    } finally {
      await chrome.kill();
    }
  }

  private extractMetrics(lhr: Result): PerformanceMetrics {
    const categories = lhr.categories;
    const audits = lhr.audits;

    return {
      performance: Math.round((categories.performance?.score ?? 0) * 100),
      accessibility: Math.round((categories.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
      seo: Math.round((categories.seo?.score ?? 0) * 100),
      metrics: {
        fcp: Math.round(audits['first-contentful-paint']?.numericValue || 0),
        lcp: Math.round(audits['largest-contentful-paint']?.numericValue || 0),
        cls: Math.round((audits['cumulative-layout-shift']?.numericValue || 0) * 1000) / 1000,
        tti: Math.round(audits['interactive']?.numericValue || 0) || 0,
      },
    };
  }

  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
