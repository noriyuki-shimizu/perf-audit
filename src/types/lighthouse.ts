/** Lighthouse options interface */
export interface LighthouseOptions {
  url: string;
  device: 'mobile' | 'desktop';
  throttling: boolean;
  outputFormat?: 'json' | 'html' | 'csv';
}

/** Lighthouse configuration interface */
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
