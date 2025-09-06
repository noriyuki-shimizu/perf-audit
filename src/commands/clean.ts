import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { PerformanceDatabase } from '../core/database.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';

export interface CleanOptions {
  force?: boolean;
  days?: number;
  all?: boolean;
}

export async function cleanCommand(options: CleanOptions): Promise<void> {
  Logger.section('Cleaning performance data...');

  try {
    const config = await loadConfig();

    // Determine what to clean
    if (options.all) {
      // Clean all data
      await cleanAllData(config, options.force);
    } else if (options.days) {
      // Clean data older than specified days
      await cleanOldData(config, options.days, options.force);
    } else {
      // Default: clean data older than 30 days
      await cleanOldData(config, 30, options.force);
    }
  } catch (error) {
    Logger.error('Clean failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
}

async function cleanAllData(config: any, force: boolean = false): Promise<void> {
  if (!force) {
    const confirmed = await confirmAction(
      'This will delete ALL performance data including database and reports. Are you sure?',
    );
    if (!confirmed) {
      Logger.warn('Clean cancelled.');
      return;
    }
  }

  // Clean database
  const dbPath = path.resolve('.perf-audit/performance.db');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    Logger.success('Database deleted');
  }

  // Clean reports
  const reportsDir = path.resolve(config.reports.outputDir);
  if (fs.existsSync(reportsDir)) {
    const files = fs.readdirSync(reportsDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      if (file.endsWith('.json') || file.endsWith('.html')) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    Logger.success(`${deletedCount} report files deleted`);
  }

  // Clean cache directory
  const cacheDir = path.resolve('.perf-audit/cache');
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    Logger.success('Cache directory cleaned');
  }

  Logger.complete('All performance data has been cleaned!');
}

async function cleanOldData(config: any, days: number, force: boolean = false): Promise<void> {
  if (!force) {
    const confirmed = await confirmAction(
      `This will delete performance data older than ${days} days. Are you sure?`,
    );
    if (!confirmed) {
      Logger.warn('Clean cancelled.');
      return;
    }
  }

  // Clean old database records
  const db = new PerformanceDatabase();
  const deletedBuilds = db.cleanup(days);
  db.close();

  Logger.success(`${deletedBuilds} old builds deleted from database`);

  // Clean old report files
  const reportsDir = path.resolve(config.reports.outputDir);
  if (fs.existsSync(reportsDir)) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const files = fs.readdirSync(reportsDir);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(reportsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtimeMs < cutoffTime && (file.endsWith('.json') || file.endsWith('.html'))) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    Logger.success(`${deletedCount} old report files deleted`);
  }

  // Clean old cache files
  const cacheDir = path.resolve('.perf-audit/cache');
  if (fs.existsSync(cacheDir)) {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // Clean cache older than 7 days
    cleanDirectoryRecursive(cacheDir, cutoffTime);
    Logger.success('Old cache files cleaned');
  }

  Logger.complete(`Performance data older than ${days} days has been cleaned!`);
}

function cleanDirectoryRecursive(dir: string, cutoffTime: number): void {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      cleanDirectoryRecursive(itemPath, cutoffTime);
      // Remove empty directories
      const remainingItems = fs.readdirSync(itemPath);
      if (remainingItems.length === 0) {
        fs.rmdirSync(itemPath);
      }
    } else if (stats.mtimeMs < cutoffTime) {
      fs.unlinkSync(itemPath);
    }
  }
}

async function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(Logger.prompt(`${message} (y/N): `), answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
