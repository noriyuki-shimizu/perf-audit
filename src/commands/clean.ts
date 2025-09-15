import fs from 'fs';
import path from 'path';
import readline from 'readline';
import {
  CACHE_DIRECTORY,
  CACHE_RETENTION_DAYS,
  DEFAULT_RETENTION_DAYS,
  MILLISECONDS_PER_DAY,
  REPORT_EXTENSIONS,
} from '../constants/index.ts';
import { PerformanceDatabaseService } from '../core/database/index.ts';
import type { CleanOptions } from '../types/commands.ts';
import type { PerfAuditConfig } from '../types/config.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';

/**
 * Execute performance data cleaning command
 * @param options - Clean command options
 */
export const cleanCommand = async (options: CleanOptions): Promise<void> => {
  Logger.section('Cleaning performance data...');

  try {
    const config = await loadConfig();

    if (options.all) {
      await cleanAllData(config, options.force);
    } else {
      const retentionDays = options.days ?? DEFAULT_RETENTION_DAYS;
      await cleanOldData(config, retentionDays, options.force);
    }
  } catch (error) {
    handleCleanError(error);
  }
};

/**
 * Clean all performance data including database and reports
 * @param config - Application configuration
 * @param force - Skip confirmation prompt
 */
const cleanAllData = async (config: PerfAuditConfig, force: boolean = false): Promise<void> => {
  if (!force) {
    const confirmed = await confirmAction(
      'This will delete ALL performance data including database and reports. Are you sure?',
    );
    if (!confirmed) {
      Logger.warn('Clean cancelled.');
      return;
    }
  }

  await cleanDatabase();
  const deletedReportsCount = cleanAllReports(config);
  cleanCacheDirectory();

  Logger.success(`${deletedReportsCount} report files deleted`);
  Logger.complete('All performance data has been cleaned!');
};

/**
 * Clean performance data older than specified days
 * @param config - Application configuration
 * @param days - Retention period in days
 * @param force - Skip confirmation prompt
 */
const cleanOldData = async (config: PerfAuditConfig, days: number, force: boolean = false): Promise<void> => {
  if (!force) {
    const confirmed = await confirmAction(
      `This will delete performance data older than ${days} days. Are you sure?`,
    );
    if (!confirmed) {
      Logger.warn('Clean cancelled.');
      return;
    }
  }

  const deletedBuilds = await cleanOldDatabaseRecords(days);
  const deletedReportsCount = cleanOldReports(config, days);
  cleanOldCacheFiles();

  Logger.success(`${deletedBuilds} old builds deleted from database`);
  Logger.success(`${deletedReportsCount} old report files deleted`);
  Logger.success('Old cache files cleaned');
  Logger.complete(`Performance data older than ${days} days has been cleaned!`);
};

/**
 * Clean database file completely
 */
const cleanDatabase = async (): Promise<void> => {
  const service = await PerformanceDatabaseService.instance();
  await service.cleanDatabase();
};

/**
 * Clean all report files
 * @param config - Application configuration
 * @returns Number of deleted files
 */
const cleanAllReports = (config: PerfAuditConfig): number => {
  const reportsDir = path.resolve(config.reports.outputDir);
  if (!fs.existsSync(reportsDir)) {
    return 0;
  }

  const files = fs.readdirSync(reportsDir);
  let deletedCount = 0;

  for (const file of files) {
    if (isReportFile(file)) {
      const filePath = path.join(reportsDir, file);
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  }

  return deletedCount;
};

/**
 * Clean cache directory completely
 */
const cleanCacheDirectory = (): void => {
  const cacheDir = path.resolve(CACHE_DIRECTORY);
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    Logger.success('Cache directory cleaned');
  }
};

/**
 * Clean old database records
 * @param days - Retention period in days
 * @returns Number of deleted builds
 */
const cleanOldDatabaseRecords = async (days: number): Promise<number> => {
  const db = await PerformanceDatabaseService.instance();
  const deletedBuilds = await db.cleanup(days);
  await db.close();
  return deletedBuilds;
};

/**
 * Clean old report files
 * @param config - Application configuration
 * @param days - Retention period in days
 * @returns Number of deleted files
 */
const cleanOldReports = (config: PerfAuditConfig, days: number): number => {
  const reportsDir = path.resolve(config.reports.outputDir);
  if (!fs.existsSync(reportsDir)) {
    return 0;
  }

  const cutoffTime = calculateCutoffTime(days);
  const files = fs.readdirSync(reportsDir);
  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(reportsDir, file);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < cutoffTime && isReportFile(file)) {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  }

  return deletedCount;
};

/**
 * Clean old cache files
 */
const cleanOldCacheFiles = (): void => {
  const cacheDir = path.resolve(CACHE_DIRECTORY);
  if (fs.existsSync(cacheDir)) {
    const cutoffTime = calculateCutoffTime(CACHE_RETENTION_DAYS);
    cleanDirectoryRecursive(cacheDir, cutoffTime);
  }
};

/**
 * Calculate cutoff timestamp for file age comparison
 * @param days - Number of days to go back
 * @returns Cutoff timestamp in milliseconds
 */
const calculateCutoffTime = (days: number): number => {
  return Date.now() - (days * MILLISECONDS_PER_DAY);
};

/**
 * Check if file is a report file based on extension
 * @param fileName - Name of the file
 * @returns Whether the file is a report file
 */
const isReportFile = (fileName: string): boolean => {
  return REPORT_EXTENSIONS.some(ext => fileName.endsWith(ext));
};

/**
 * Recursively clean directory of old files
 * @param dir - Directory path
 * @param cutoffTime - Cutoff timestamp for file age
 */
const cleanDirectoryRecursive = (dir: string, cutoffTime: number): void => {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = fs.statSync(itemPath);

    if (stats.isDirectory()) {
      cleanDirectoryRecursive(itemPath, cutoffTime);
      removeEmptyDirectory(itemPath);
    } else if (isOldFile(stats, cutoffTime)) {
      fs.unlinkSync(itemPath);
    }
  }
};

/**
 * Check if file is old based on modification time
 * @param stats - File statistics
 * @param cutoffTime - Cutoff timestamp
 * @returns Whether the file is old
 */
const isOldFile = (stats: fs.Stats, cutoffTime: number): boolean => {
  return stats.mtimeMs < cutoffTime;
};

/**
 * Remove directory if it's empty
 * @param dirPath - Directory path
 */
const removeEmptyDirectory = (dirPath: string): void => {
  const remainingItems = fs.readdirSync(dirPath);
  if (remainingItems.length === 0) {
    fs.rmdirSync(dirPath);
  }
};

/**
 * Show confirmation prompt to user
 * @param message - Confirmation message
 * @returns Promise resolving to user confirmation
 */
const confirmAction = async (message: string): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(Logger.prompt(`${message} (y/N): `), answer => {
      rl.close();
      const normalizedAnswer = answer.toLowerCase();
      resolve(normalizedAnswer === 'y' || normalizedAnswer === 'yes');
    });
  });
};

/**
 * Handle errors during clean operation
 * @param error - Error object
 */
const handleCleanError = (error: unknown): void => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  Logger.error('Clean failed', { error: errorMessage });
  process.exit(1);
};
