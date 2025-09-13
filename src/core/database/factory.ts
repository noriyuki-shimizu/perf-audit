import type { DatabaseConfig, DatabaseConnection, Repository } from '../../types/database/index.ts';
import { SqliteConnection } from './sqlite/connection.ts';
import { SqliteRepository } from './sqlite/repositories.ts';

/**
 * データベースファクトリー
 * 設定に基づいて適切なデータベース接続とリポジトリを作成
 */
export class DatabaseFactory {
  private static connections = new Map<string, DatabaseConnection>();
  private static repositories = new Map<string, Repository>();

  /**
   * データベース接続を作成
   */
  static createConnection(config: DatabaseConfig): DatabaseConnection {
    const connectionKey = this.generateConnectionKey(config);

    // 既存の接続があれば再利用
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey)!;
    }

    let connection: DatabaseConnection;

    switch (config.type) {
      case 'sqlite':
        connection = new SqliteConnection(config.database);
        break;

      case 'mysql':
      case 'postgresql':
        throw new Error(`Database type '${config.type}' is not implemented yet`);

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }

    this.connections.set(connectionKey, connection);
    return connection;
  }

  /**
   * Unit of Work を作成
   */
  static createRepository(config: DatabaseConfig): Repository {
    const connectionKey = this.generateConnectionKey(config);

    // 既存のRepositoryがあれば再利用
    if (this.repositories.has(connectionKey)) {
      return this.repositories.get(connectionKey)!;
    }

    const connection = this.createConnection(config);
    let repository: Repository;

    switch (config.type) {
      case 'sqlite':
        repository = new SqliteRepository(connection);
        break;

      case 'mysql':
      case 'postgresql':
        throw new Error(`Database type '${config.type}' is not implemented yet`);

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }

    this.repositories.set(connectionKey, repository);
    return repository;
  }

  /**
   * 環境変数から設定を作成
   */
  static createConfigFromEnv(): DatabaseConfig {
    const dbType = (process.env.PERF_AUDIT_DB_TYPE ?? 'sqlite') as DatabaseConfig['type'];

    switch (dbType) {
      case 'sqlite':
        return {
          type: 'sqlite',
          database: process.env.PERF_AUDIT_DB_PATH ?? '.perf-audit/performance.db',
        };

      case 'mysql':
        return {
          type: 'mysql',
          host: process.env.PERF_AUDIT_DB_HOST ?? 'localhost',
          port: parseInt(process.env.PERF_AUDIT_DB_PORT ?? '3306', 10),
          database: process.env.PERF_AUDIT_DB_NAME ?? 'perf_audit',
          username: process.env.PERF_AUDIT_DB_USER ?? 'root',
          password: process.env.PERF_AUDIT_DB_PASSWORD ?? '',
        };

      case 'postgresql':
        return {
          type: 'postgresql',
          host: process.env.PERF_AUDIT_DB_HOST ?? 'localhost',
          port: parseInt(process.env.PERF_AUDIT_DB_PORT ?? '5432', 10),
          database: process.env.PERF_AUDIT_DB_NAME ?? 'perf_audit',
          username: process.env.PERF_AUDIT_DB_USER ?? 'postgres',
          password: process.env.PERF_AUDIT_DB_PASSWORD ?? '',
        };

      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  /**
   * 接続をクリーンアップ
   */
  static async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    // Repository を閉じる
    for (const [key, repository] of this.repositories) {
      closePromises.push(repository.close());
      this.repositories.delete(key);
    }

    // 残りの接続を閉じる
    for (const [key, connection] of this.connections) {
      closePromises.push(connection.close());
      this.connections.delete(key);
    }

    await Promise.all(closePromises);
  }

  /**
   * 特定の接続を閉じる
   */
  static async closeConnection(config: DatabaseConfig): Promise<void> {
    const connectionKey = this.generateConnectionKey(config);

    if (this.repositories.has(connectionKey)) {
      await this.repositories.get(connectionKey)!.close();
      this.repositories.delete(connectionKey);
    }

    if (this.connections.has(connectionKey)) {
      await this.connections.get(connectionKey)!.close();
      this.connections.delete(connectionKey);
    }
  }

  /**
   * 接続キーを生成
   */
  private static generateConnectionKey(config: DatabaseConfig): string {
    switch (config.type) {
      case 'sqlite':
        return `sqlite:${config.database}`;

      case 'mysql':
      case 'postgresql':
        return `${config.type}://${config.username}@${config.host}:${config.port}/${config.database}`;

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }

  /**
   * 接続状態を取得
   */
  static getConnectionStatus(): Array<{ key: string; type: string; }> {
    const status: Array<{ key: string; type: string; }> = [];

    for (const key of this.connections.keys()) {
      status.push({ key, type: 'connection' });
    }

    for (const key of this.repositories.keys()) {
      status.push({ key, type: 'repository' });
    }

    return status;
  }
}
