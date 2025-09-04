import fs from 'fs';
import path from 'path';
import { beforeEach, vi } from 'vitest';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Setup test data directory
const testDataDir = path.join(process.cwd(), 'test/test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

// Clean up test data before each test suite
beforeEach(() => {
  vi.clearAllMocks();
});

// Global test helpers
global.testHelpers = {
  createTempDir: () => {
    const tempDir = path.join(testDataDir, `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    return tempDir;
  },

  createMockBundle: (name: string, size: number, gzipSize?: number) => ({
    name,
    size,
    gzipSize,
    status: 'ok' as const,
  }),

  createMockConfig: () => ({
    project: {
      type: 'webpack' as const,
      configPath: './webpack.config.js',
      outputPath: './dist',
    },
    budgets: {
      bundles: {
        main: { max: '150KB', warning: '120KB' },
        vendor: { max: '100KB', warning: '80KB' },
        total: { max: '500KB', warning: '400KB' },
      },
      lighthouse: {
        performance: { min: 90, warning: 95 },
        accessibility: { min: 95 },
        seo: { min: 90 },
      },
      metrics: {
        fcp: { max: 1500, warning: 1000 },
        lcp: { max: 2500, warning: 2000 },
        cls: { max: 0.1, warning: 0.05 },
        tti: { max: 3500, warning: 3000 },
      },
    },
    analysis: {
      gzip: true,
      brotli: false,
      sourceMaps: true,
      ignorePaths: ['**/*.test.js', '**/*.spec.js'],
    },
    reports: {
      formats: ['console', 'json', 'html'] as const,
      outputDir: './performance-reports',
      retention: 30,
    },
    plugins: [
      { name: 'bundle-analyzer', enabled: true },
      { name: 'performance-tracker', enabled: true },
    ],
  }),
};

// Type declarations for global helpers
declare global {
  var testHelpers: {
    createTempDir: () => string;
    createMockBundle: (name: string, size: number, gzipSize?: number) => any;
    createMockConfig: () => any;
  };
}
