import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { PerformanceMetrics } from '../types/config.js';

export interface LighthouseOptions {
  url: string;
  device: 'mobile' | 'desktop';
  throttling: boolean;
  outputFormat?: 'json' | 'html' | 'csv';
}

export interface LighthouseConfig {
  extends: 'lighthouse:default';
  settings: {
    onlyCategories?: string[];
    skipAudits?: string[];
    throttlingMethod?: 'devtools' | 'provided' | 'simulate';
    throttling?: {
      rttMs: number;
      throughputKbps: number;
      cpuSlowdownMultiplier: number;
    };
    formFactor?: 'mobile' | 'desktop';
    screenEmulation?: {
      mobile: boolean;
      width: number;
      height: number;
      deviceScaleFactor: number;
      disabled: boolean;
    };
  };
}

export class LighthouseRunner {
  private static getDesktopConfig(): LighthouseConfig {
    return {
      extends: 'lighthouse:default',
      settings: {
        throttlingMethod: 'simulate',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
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
          rttMs: 150,
          throughputKbps: 1638,
          cpuSlowdownMultiplier: 4,
        },
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 360,
          height: 640,
          deviceScaleFactor: 2.625,
          disabled: false,
        },
      },
    };
  }

  async runAudit(options: LighthouseOptions): Promise<PerformanceMetrics & { rawResult?: any; }> {
    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });

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

  private extractMetrics(lhr: any): PerformanceMetrics {
    const categories = lhr.categories;
    const audits = lhr.audits;

    return {
      performance: Math.round(categories.performance?.score * 100) || 0,
      accessibility: Math.round(categories.accessibility?.score * 100) || 0,
      bestPractices: Math.round(categories['best-practices']?.score * 100) || 0,
      seo: Math.round(categories.seo?.score * 100) || 0,
      metrics: {
        fcp: Math.round(audits['first-contentful-paint']?.numericValue) || 0,
        lcp: Math.round(audits['largest-contentful-paint']?.numericValue) || 0,
        cls: Math.round((audits['cumulative-layout-shift']?.numericValue || 0) * 1000) / 1000,
        tti: Math.round(audits['interactive']?.numericValue) || 0,
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
