import fs from 'fs';
import { gzipSize } from 'gzip-size';
import path from 'path';
import { BundleInfo } from '../types/config.js';
import { getStatus, parseSize } from '../utils/size.js';

export interface AnalyzeOptions {
  outputPath: string;
  gzip: boolean;
  ignorePaths: string[];
}

export class BundleAnalyzer {
  private options: AnalyzeOptions;

  constructor(options: AnalyzeOptions) {
    this.options = options;
  }

  async analyzeBundles(): Promise<BundleInfo[]> {
    if (!fs.existsSync(this.options.outputPath)) {
      return []; // Return empty array instead of throwing error
    }

    const files = await this.getFiles(this.options.outputPath);
    const bundles: BundleInfo[] = [];

    for (const file of files) {
      if (this.shouldIgnore(file)) {
        continue;
      }

      const bundleInfo = await this.analyzeSingleBundle(file);
      bundles.push(bundleInfo);
    }

    return bundles;
  }

  private async getFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const subFiles = await this.getFiles(fullPath);
        files.push(...subFiles);
      } else if (this.isBundleFile(item)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private isBundleFile(filename: string): boolean {
    const bundleExtensions = ['.js', '.css', '.mjs'];
    return bundleExtensions.some(ext => filename.endsWith(ext))
      && !filename.includes('.map');
  }

  private shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(process.cwd(), filePath);

    return this.options.ignorePaths.some(pattern => {
      // Simple glob pattern matching
      const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');

      return new RegExp(regex).test(relativePath);
    });
  }

  private async analyzeSingleBundle(filePath: string): Promise<BundleInfo> {
    const stats = fs.statSync(filePath);
    const size = stats.size;

    let bundleGzipSize: number | undefined;
    if (this.options.gzip) {
      const content = fs.readFileSync(filePath);
      bundleGzipSize = await gzipSize(content);
    }

    const name = path.relative(this.options.outputPath, filePath);

    return {
      name,
      size,
      gzipSize: bundleGzipSize,
      status: 'ok', // Will be determined later based on budgets
    };
  }

  static calculateTotalSize(bundles: BundleInfo[]): { size: number; gzipSize?: number; } {
    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0);
    const totalGzipSize = bundles.every(b => b.gzipSize !== undefined)
      ? bundles.reduce((sum, bundle) => sum + (bundle.gzipSize || 0), 0)
      : undefined;

    return { size: totalSize, gzipSize: totalGzipSize };
  }

  static applyBudgets(
    bundles: BundleInfo[],
    budgets: { [key: string]: { max: string; warning: string; }; },
  ): BundleInfo[] {
    return bundles.map(bundle => {
      const budgetKey = this.getBudgetKey(bundle.name);
      const budget = budgets[budgetKey];

      if (!budget) {
        return bundle;
      }

      const maxSize = parseSize(budget.max);
      const warningSize = parseSize(budget.warning);
      const status = getStatus(bundle.size, warningSize, maxSize);

      return { ...bundle, status };
    });
  }

  private static getBudgetKey(bundleName: string): string {
    // Map bundle names to budget keys
    const name = bundleName.toLowerCase();

    if (name.includes('main') || name.includes('index')) return 'main';
    if (name.includes('vendor') || name.includes('chunk')) return 'vendor';
    if (name.includes('runtime')) return 'runtime';

    return 'main'; // default
  }
}
