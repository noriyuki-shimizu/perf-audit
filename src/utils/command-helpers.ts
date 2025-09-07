import ora, { type Ora } from 'ora';
import { PerformanceDatabase } from '../core/database.ts';
import { PluginManager } from '../core/plugin-system.ts';
import type { AuditResult, PerfAuditConfig, PerformanceMetrics } from '../types/config.ts';
import { CIIntegration } from './ci-integration.ts';
import { loadConfig } from './config.ts';
import { Logger } from './logger.ts';

/**
 * 現在のタイムスタンプをISO文字列として取得
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * コマンド初期化の共通処理
 */
export const initializeCommand = async (message = 'Loading configuration...'): Promise<{
  config: PerfAuditConfig;
  spinner: Ora;
}> => {
  const spinner = ora(message).start();
  const config = await loadConfig();
  return { config, spinner };
};

/**
 * プラグインマネージャーの初期化
 */
export const initializePluginManager = async (config: PerfAuditConfig): Promise<PluginManager> => {
  const pluginManager = new PluginManager(config);
  await pluginManager.loadPlugins();
  return pluginManager;
};

/**
 * データベースにビルドデータを保存
 */
export const saveBuildData = async (
  result: AuditResult,
  additionalData?: {
    url?: string;
    device?: string;
    metrics?: PerformanceMetrics;
  },
): Promise<void> => {
  try {
    const ciContext = CIIntegration.detectCIEnvironment();
    const db = new PerformanceDatabase();

    const buildId = db.saveBuild({
      timestamp: result.timestamp,
      branch: ciContext.branch,
      commitHash: ciContext.commitHash,
      url: additionalData?.url,
      device: additionalData?.device,
      bundles: result.bundles,
      metrics: additionalData?.metrics,
      recommendations: result.recommendations,
    });

    db.close();
    Logger.debug(`Build saved with ID: ${buildId}`);
  } catch {
    Logger.warn('Failed to save build to database');
  }
};

/**
 * エラー発生時の共通処理
 */
export const handleCommandError = async (
  spinner: Ora,
  error: unknown,
  message = 'Operation failed',
  config?: PerfAuditConfig,
): Promise<void> => {
  spinner.fail(message);
  Logger.error(error instanceof Error ? error.message : 'Unknown error');

  if (config) {
    try {
      const pluginManager = new PluginManager(config);
      await pluginManager.loadPlugins();
      await pluginManager.executeHook('onError', {
        error: error as Error,
        context: 'command',
      });
      await pluginManager.unloadPlugins();
    } catch {
      // Ignore plugin errors during error handling
    }
  }

  process.exit(1);
};

/**
 * コマンド正常終了の共通処理
 */
export const completeCommand = (
  spinner: Ora,
  message: string,
  shouldExit = false,
  exitCode = 0,
): void => {
  spinner.succeed(message);

  if (shouldExit) {
    process.exit(exitCode);
  }
};

/**
 * 条件に応じてプロセス終了
 */
export const exitBasedOnStatus = (status: 'ok' | 'warning' | 'error'): void => {
  switch (status) {
    case 'error':
      process.exit(1);
      // eslint-disable-next-line no-unreachable
      break;
    case 'warning':
      process.exit(2);
      // eslint-disable-next-line no-unreachable
      break;
    default:
      // 正常終了: 何もしない
      break;
  }
};
