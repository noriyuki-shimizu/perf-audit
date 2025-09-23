import ora, { type Ora } from 'ora';
import { PerformanceDatabaseService } from '../core/database/index.ts';
import { PluginManager } from '../core/plugin-system.ts';
import type { AuditResult, PerfAuditConfig, PerformanceMetrics } from '../types/config.ts';
import { CIIntegration } from './ci-integration.ts';
import { loadConfig } from './config.ts';
import { Logger } from './logger.ts';

/**
 * 現在のタイムスタンプをISO文字列として取得
 * @returns ISO形式のタイムスタンプ文字列
 */
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * コマンド初期化の共通処理
 * @param message - スピナーに表示するメッセージ
 * @returns 設定とスピナーオブジェクト
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
 * @param config - アプリケーション設定
 * @returns 初期化されたプラグインマネージャー
 */
export const initializePluginManager = async (config: PerfAuditConfig): Promise<PluginManager> => {
  const pluginManager = new PluginManager(config);
  await pluginManager.loadPlugins();
  return pluginManager;
};

/**
 * データベースにビルドデータを保存
 * @param result - 監査結果オブジェクト
 * @param additionalData - 追加のビルドデータ（URL、デバイス、パフォーマンス指標など）
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
    const db = await PerformanceDatabaseService.instance();

    const buildId = await db.saveBuild({
      timestamp: result.timestamp,
      branch: ciContext.branch,
      commitHash: ciContext.commitHash,
      url: additionalData?.url,
      device: additionalData?.device,
      bundles: [...result.serverBundles, ...result.clientBundles],
      metrics: additionalData?.metrics,
      recommendations: result.recommendations,
    });

    await db.close();
    Logger.debug(`Build saved with ID: ${buildId}`);
  } catch (error) {
    Logger.warn('Failed to save build to database');
    Logger.debug(`Database error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * エラー発生時の共通処理
 * @param spinner - スピナーオブジェクト
 * @param error - 発生したエラー
 * @param message - スピナーに表示するメッセージ
 * @param config - アプリケーション設定（プラグイン用）
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
 * @param spinner - スピナーオブジェクト
 * @param message - スピナーに表示するメッセージ
 * @param shouldExit - 終了するかどうか
 * @param exitCode - 終了コード
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
 * @param status - 'ok', 'warning', 'error' のいずれかのステータス
 */
export const exitBasedOnStatus = (status: 'ok' | 'warning' | 'error'): void => {
  switch (status) {
    case 'error':
      process.exit(1);
      break;
    case 'warning':
      process.exit(2);
      break;
    default:
      // 正常終了: 何もしない
      break;
  }
};
