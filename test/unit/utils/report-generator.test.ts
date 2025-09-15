import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditResult } from '../../../src/types/config.ts';
import { ReportGenerator } from '../../../src/utils/report-generator.ts';

vi.setConfig({ testTimeout: 100 });

vi.mock('fs');
vi.mock('path');
vi.mock('../../../src/utils/package.ts', () => ({
  getPackageJson: vi.fn(() => ({ version: '0.2.2' })),
}));

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

describe('ReportGenerator', () => {
  const mockAuditResult: AuditResult = {
    timestamp: '2023-01-01T00:00:00.000Z',
    analysisType: 'client',
    bundles: [
      {
        name: 'main.js',
        size: 100000,
        gzipSize: 30000,
        status: 'ok',
        type: 'client',
      },
      {
        name: 'vendor.js',
        size: 200000,
        gzipSize: 60000,
        status: 'warning',
        type: 'client',
      },
    ],
    budgetStatus: 'warning',
    recommendations: ['Consider code splitting', 'Optimize images'],
    lighthouse: {
      performance: 85,
      accessibility: 90,
      bestPractices: 88,
      seo: 92,
      metrics: {
        fcp: 1200,
        lcp: 2000,
        cls: 0.08,
        tti: 3000,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateJsonReport', () => {
    it('should generate JSON report with correct structure', () => {
      const outputPath = './reports/report.json';
      const mockDir = './reports';

      mockPath.dirname.mockReturnValue(mockDir);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateJsonReport(mockAuditResult, outputPath);

      expect(mockPath.dirname).toHaveBeenCalledWith(outputPath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('"reportType": "performance-audit"'),
      );
    });

    it('should create directory when it does not exist', () => {
      const outputPath = './reports/report.json';
      const mockDir = './reports';

      mockPath.dirname.mockReturnValue(mockDir);
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateJsonReport(mockAuditResult, outputPath);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockDir, { recursive: true });
    });

    it('should include summary statistics in JSON report', () => {
      const outputPath = './reports/report.json';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateJsonReport(mockAuditResult, outputPath);

      const [, reportContent] = mockFs.writeFileSync.mock.calls[0];
      const report = JSON.parse(reportContent as string);

      expect(report.summary).toEqual({
        budgetStatus: 'warning',
        totalBundles: 2,
        totalSize: 300000,
        totalGzipSize: 90000,
      });
    });

    it('should include all audit result data in JSON report', () => {
      const outputPath = './reports/report.json';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateJsonReport(mockAuditResult, outputPath);

      const [, reportContent] = mockFs.writeFileSync.mock.calls[0];
      const report = JSON.parse(reportContent as string);

      expect(report.bundles).toEqual(mockAuditResult.bundles);
      expect(report.lighthouse).toEqual(mockAuditResult.lighthouse);
      expect(report.recommendations).toEqual(mockAuditResult.recommendations);
    });
  });

  describe('generateHtmlReport', () => {
    it('should generate HTML report', () => {
      const outputPath = './reports/report.html';
      const mockDir = './reports';

      mockPath.dirname.mockReturnValue(mockDir);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(mockAuditResult, outputPath);

      expect(mockPath.dirname).toHaveBeenCalledWith(outputPath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('<!DOCTYPE html>'),
      );
    });

    it('should create directory when it does not exist', () => {
      const outputPath = './reports/report.html';
      const mockDir = './reports';

      mockPath.dirname.mockReturnValue(mockDir);
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(mockAuditResult, outputPath);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockDir, { recursive: true });
    });

    it('should include correct HTML structure', () => {
      const outputPath = './reports/report.html';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(mockAuditResult, outputPath);

      const [, htmlContent] = mockFs.writeFileSync.mock.calls[0];
      const html = htmlContent as string;

      expect(html).toContain('<title>Performance Audit Report</title>');
      expect(html).toContain('🎯 Performance Audit Report');
      expect(html).toContain('Overall Status');
      expect(html).toContain('Total Bundles');
      expect(html).toContain('Total Size');
    });

    it('should include bundle table in HTML', () => {
      const outputPath = './reports/report.html';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(mockAuditResult, outputPath);

      const [, htmlContent] = mockFs.writeFileSync.mock.calls[0];
      const html = htmlContent as string;

      expect(html).toContain('📦 Bundle Analysis');
      expect(html).toContain('<table class="bundle-table">');
      expect(html).toContain('main.js');
      expect(html).toContain('vendor.js');
      expect(html).toContain('97.7KB'); // main.js size
      expect(html).toContain('195.3KB'); // vendor.js size
    });

    it('should include Lighthouse section when available', () => {
      const outputPath = './reports/report.html';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(mockAuditResult, outputPath);

      const [, htmlContent] = mockFs.writeFileSync.mock.calls[0];
      const html = htmlContent as string;

      expect(html).toContain('📊 Lighthouse Scores');
      expect(html).toContain('Performance');
      expect(html).toContain('Accessibility');
      expect(html).toContain('🚀 Core Web Vitals');
      expect(html).toContain('First Contentful Paint');
    });

    it('should include recommendations section when available', () => {
      const outputPath = './reports/report.html';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(mockAuditResult, outputPath);

      const [, htmlContent] = mockFs.writeFileSync.mock.calls[0];
      const html = htmlContent as string;

      expect(html).toContain('💡 Recommendations');
      expect(html).toContain('Consider code splitting');
      expect(html).toContain('Optimize images');
    });

    it('should handle result without Lighthouse data', () => {
      const resultWithoutLighthouse = {
        ...mockAuditResult,
        lighthouse: undefined,
      };
      const outputPath = './reports/report.html';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(resultWithoutLighthouse, outputPath);

      const [, htmlContent] = mockFs.writeFileSync.mock.calls[0];
      const html = htmlContent as string;

      expect(html).not.toContain('📊 Lighthouse Scores');
      expect(html).not.toContain('🚀 Core Web Vitals');
    });

    it('should handle result without recommendations', () => {
      const resultWithoutRecommendations = {
        ...mockAuditResult,
        recommendations: [],
      };
      const outputPath = './reports/report.html';

      mockPath.dirname.mockReturnValue('./reports');
      mockFs.existsSync.mockReturnValue(true);
      mockFs.writeFileSync.mockImplementation(() => {});

      ReportGenerator.generateHtmlReport(resultWithoutRecommendations, outputPath);

      const [, htmlContent] = mockFs.writeFileSync.mock.calls[0];
      const html = htmlContent as string;

      expect(html).not.toContain('💡 Recommendations');
    });
  });
});
