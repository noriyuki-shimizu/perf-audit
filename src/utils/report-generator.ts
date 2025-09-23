import fs from 'fs';
import path from 'path';
import type { AuditResult, PerformanceMetrics } from '../types/config.ts';
import { getPackageJson } from '../utils/package.ts';
import { formatSize } from './size.ts';

export class ReportGenerator {
  private static version = getPackageJson(import.meta.url).version;

  static generateJsonReport(result: AuditResult, outputPath: string): void {
    const report = {
      meta: {
        version: ReportGenerator.version,
        timestamp: result.timestamp,
        reportType: 'performance-audit',
      },
      summary: {
        budgetStatus: result.budgetStatus,
        server: {
          totalBundles: result.serverBundles.length,
          totalSize: result.serverBundles.reduce((sum, b) => sum + b.size, 0),
          totalGzipSize: result.serverBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0),
        },
        client: {
          totalBundles: result.clientBundles.length,
          totalSize: result.clientBundles.reduce((sum, b) => sum + b.size, 0),
          totalGzipSize: result.clientBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0),
        },
      },
      bundles: {
        server: result.serverBundles,
        client: result.clientBundles,
      },
      lighthouse: result.lighthouse,
      recommendations: result.recommendations,
    };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }

  static generateHtmlReport(result: AuditResult, outputPath: string): void {
    const html = this.buildHtmlTemplate(result);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html);
  }

  private static buildHtmlTemplate(result: AuditResult): string {
    const timestamp = new Date(result.timestamp).toLocaleString();
    const serverTotalSize = result.serverBundles.reduce((sum, b) => sum + b.size, 0);
    const serverTotalGzipSize = result.serverBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0);
    const clientTotalSize = result.clientBundles.reduce((sum, b) => sum + b.size, 0);
    const clientTotalGzipSize = result.clientBundles.reduce((sum, b) => sum + (b.gzipSize || 0), 0);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Audit Report</title>
    <style>
        ${this.getCSS()}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="header__title">🎯 Performance Audit Report</h1>
            <p class="header__timestamp">Generated: ${timestamp}</p>
        </header>

        <div class="record record--${result.budgetStatus}">
            <h3 class="record__title">Overall Status</h3>
            <div class="record__status-indicator">
                ${this.getStatusIcon(result.budgetStatus)} ${result.budgetStatus.toUpperCase()}
            </div>
        </div>

        <div class="summary-cards">
            <div class="card">
                <h3 class="card__title">Server Total Bundles</h3>
                <div class="card__metric">${result.serverBundles.length}</div>
            </div>
            <div class="card">
                <h3 class="card__title">Server Total Size</h3>
                <div class="card__metric">${formatSize(serverTotalSize)}</div>
                <div class="card__sub-metric">Gzipped: ${formatSize(serverTotalGzipSize)}</div>
            </div>
        </div>

        <section class="section">
            <h2 class="section__title">📦 Server Bundle Analysis</h2>
            <div class="table-container">
                <table class="bundle-table">
                    <thead>
                        <tr>
                            <th class="bundle-table__header">Bundle</th>
                            <th class="bundle-table__header">Size</th>
                            <th class="bundle-table__header">Gzipped</th>
                            <th class="bundle-table__header">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
      result.serverBundles.map(bundle => `
                            <tr class="bundle-table__record--${bundle.status}">
                                <td class="bundle-table__data bundle-name">${bundle.name}</td>
                                <td class="bundle-table__data">${formatSize(bundle.size)}</td>
                                <td class="bundle-table__data">${
        bundle.gzipSize ? formatSize(bundle.gzipSize) : 'N/A'
      }</td>
                                <td class="bundle-table__data status">${
        this.getStatusIcon(bundle.status)
      } ${bundle.status}</td>
                            </tr>
                        `).join('')
    }
                    </tbody>
                </table>
            </div>
        </section>

        <div class="summary-cards">
            <div class="card">
                <h3 class="card__title">Client Total Bundles</h3>
                <div class="card__metric">${result.clientBundles.length}</div>
            </div>
            <div class="card">
                <h3 class="card__title">Client Total Size</h3>
                <div class="card__metric">${formatSize(clientTotalSize)}</div>
                <div class="card__sub-metric">Gzipped: ${formatSize(clientTotalGzipSize)}</div>
            </div>
        </div>

        <section class="section">
            <h2 class="section__title">📦 Client Bundle Analysis</h2>
            <div class="table-container">
                <table class="bundle-table">
                    <thead>
                        <tr>
                            <th class="bundle-table__header">Bundle</th>
                            <th class="bundle-table__header">Size</th>
                            <th class="bundle-table__header">Gzipped</th>
                            <th class="bundle-table__header">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
      result.clientBundles.map(bundle => `
                            <tr class="bundle-table__record--${bundle.status}">
                                <td class="bundle-table__data bundle-name">${bundle.name}</td>
                                <td class="bundle-table__data">${formatSize(bundle.size)}</td>
                                <td class="bundle-table__data">${
        bundle.gzipSize ? formatSize(bundle.gzipSize) : 'N/A'
      }</td>
                                <td class="bundle-table__data status">${
        this.getStatusIcon(bundle.status)
      } ${bundle.status}</td>
                            </tr>
                        `).join('')
    }
                    </tbody>
                </table>
            </div>
        </section>

        ${result.lighthouse ? this.buildLighthouseSection(result.lighthouse) : ''}

        ${result.recommendations.length > 0 ? this.buildRecommendationsSection(result.recommendations) : ''}

        <footer class="footer">
            <p>Generated by <strong>perf-audit-cli</strong> v${ReportGenerator.version}</p>
        </footer>
    </div>

    <script>
        ${this.getJavaScript()}
    </script>
</body>
</html>
`;
  }

  private static buildLighthouseSection(lighthouse: PerformanceMetrics): string {
    return `
        <section class="section">
            <h2>📊 Lighthouse Scores</h2>
            <div class="lighthouse-scores">
                <div class="score-card">
                    <h4 class="score-card__title">Performance</h4>
                    <div class="score score--${
      this.getScoreClass(lighthouse.performance)
    }">${lighthouse.performance}</div>
                </div>
                <div class="score-card">
                    <h4 class="score-card__title">Accessibility</h4>
                    <div class="score score--${this.getScoreClass(lighthouse.accessibility || 0)}">${
      lighthouse.accessibility || 'N/A'
    }</div>
                </div>
                <div class="score-card">
                    <h4 class="score-card__title">Best Practices</h4>
                    <div class="score score--${this.getScoreClass(lighthouse.bestPractices || 0)}">${
      lighthouse.bestPractices || 'N/A'
    }</div>
                </div>
                <div class="score-card">
                    <h4 class="score-card__title">SEO</h4>
                    <div class="score score--${this.getScoreClass(lighthouse.seo || 0)}">${
      lighthouse.seo || 'N/A'
    }</div>
                </div>
            </div>

            ${
      lighthouse.metrics
        ? `
                <h3>🚀 Core Web Vitals</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h4 class="metric-card__title">First Contentful Paint</h4>
                        <div class="metric-value">${lighthouse.metrics.fcp}ms</div>
                    </div>
                    <div class="metric-card">
                        <h4 class="metric-card__title">Largest Contentful Paint</h4>
                        <div class="metric-value">${lighthouse.metrics.lcp}ms</div>
                    </div>
                    <div class="metric-card">
                        <h4 class="metric-card__title">Cumulative Layout Shift</h4>
                        <div class="metric-value">${lighthouse.metrics.cls}</div>
                    </div>
                    <div class="metric-card">
                        <h4 class="metric-card__title">Time to Interactive</h4>
                        <div class="metric-value">${lighthouse.metrics.tti}ms</div>
                    </div>
                </div>
            `
        : ''
    }
        </section>
    `;
  }

  private static buildRecommendationsSection(recommendations: string[]): string {
    return `
        <section class="section">
            <h2>💡 Recommendations</h2>
            <ul class="recommendations">
                ${recommendations.map(rec => `<li class="recommendations__item">${rec}</li>`).join('')}
            </ul>
        </section>
    `;
  }

  private static getStatusIcon(status: string): string {
    switch (status) {
      case 'ok':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '●';
    }
  }

  private static getScoreClass(score: number): string {
    if (score >= 90) return 'good';
    if (score >= 75) return 'average';
    return 'poor';
  }

  private static getCSS(): string {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
      }

      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }

      .header {
        text-align: center;
        background: white;
        border-radius: 10px;
        padding: 30px;
        margin-bottom: 30px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }

      .header__title {
        color: #2d3748;
        font-size: 2.5em;
        margin-bottom: 10px;
      }

      .header__timestamp {
        color: #718096;
        font-size: 1.1em;
      }

      .record {
        text-align: center;
        background: white;
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 30px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }

      .record__title {
        color: #2d3748;
        margin-bottom: 15px;
        font-size: 1.2em;
      }

      .record__status-indicator {
        font-size: 1.5em;
        font-weight: bold;
      }

      .record--ok {
        border-left: 5px solid #48bb78;
      }

      .record--warning {
        border-left: 5px solid #ed8936;
      }

      .record--error {
        border-left: 5px solid #f56565;
      }

      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 16px;
      }

      .card {
        background: white;
        border-radius: 10px;
        padding: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        text-align: center;
      }

      .card__title {
        color: #2d3748;
        margin-bottom: 15px;
        font-size: 1.2em;
      }

      .card__metric {
        font-size: 2em;
        font-weight: bold;
        color: #2d3748;
      }

      .card__sub-metric {
        color: #718096;
        margin-top: 5px;
      }

      .section {
        background: white;
        border-radius: 10px;
        padding: 30px;
        margin-bottom: 30px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      }

      .section__title {
        color: #2d3748;
        margin-bottom: 20px;
        font-size: 1.8em;
      }

      .table-container {
        overflow-x: auto;
      }

      .bundle-table {
        width: 100%;
        border-collapse: collapse;
      }

      .bundle-table__header,
      .bundle-table__data {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }

      .bundle-table__header {
        background: #f7fafc;
        font-weight: 600;
        color: #2d3748;
      }

      .bundle-table__record--ok {
        background: #f0fff4;
      }

      .bundle-table__record--warning {
        background: #fffbf0;
      }

      .bundle-table__record--error {
        background: #fff5f5;
      }

      .bundle-name {
        font-family: 'Monaco', 'Menlo', monospace;
        font-size: 0.9em;
      }

      .status {
        font-weight: 600;
      }

      .lighthouse-scores {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }

      .score-card {
        text-align: center;
        padding: 20px;
        border-radius: 8px;
        background: #f7fafc;
      }

      .score-card__title {
        color: #2d3748;
        margin-bottom: 10px;
      }

      .score {
        font-size: 3em;
        font-weight: bold;
        border-radius: 50%;
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto;
      }

      .score--good {
        background: #48bb78;
        color: white;
      }

      .score--average {
        background: #ed8936;
        color: white;
      }

      .score--poor {
        background: #f56565;
        color: white;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
      }

      .metric-card {
        padding: 20px;
        background: #f7fafc;
        border-radius: 8px;
        text-align: center;
      }

      .metric-card__title {
        color: #2d3748;
        margin-bottom: 10px;
        font-size: 0.9em;
      }

      .metric-value {
        font-size: 1.8em;
        font-weight: bold;
        color: #4a5568;
      }

      .recommendations {
        list-style: none;
      }

      .recommendations__item {
        background: #f7fafc;
        padding: 15px;
        border-left: 4px solid #3182ce;
        margin-bottom: 10px;
        border-radius: 0 8px 8px 0;
      }

      .footer {
        text-align: center;
        padding: 20px;
        color: white;
      }

      @media (max-width: 768px) {
        .container {
          padding: 10px;
        }

        .header h1 {
          font-size: 2em;
        }

        .summary-cards {
          grid-template-columns: 1fr;
        }

        .section {
          padding: 20px;
        }
      }
    `;
  }

  private static getJavaScript(): string {
    return `
        // Add interactive features
        document.addEventListener('DOMContentLoaded', function() {
            // Highlight rows on hover
            const rows = document.querySelectorAll('.bundle-table tbody tr');
            rows.forEach(row => {
                row.addEventListener('mouseenter', function() {
                    this.style.transform = 'scale(1.02)';
                    this.style.transition = 'transform 0.2s ease';
                });
                
                row.addEventListener('mouseleave', function() {
                    this.style.transform = 'scale(1)';
                });
            });

            // Add copy functionality for bundle names
            const bundleNames = document.querySelectorAll('.bundle-name');
            bundleNames.forEach(name => {
                name.style.cursor = 'pointer';
                name.title = 'Click to copy';
                name.addEventListener('click', function() {
                    navigator.clipboard.writeText(this.textContent);
                    const originalText = this.textContent;
                    this.textContent = 'Copied!';
                    setTimeout(() => {
                        this.textContent = originalText;
                    }, 1000);
                });
            });
        });
    `;
  }
}
