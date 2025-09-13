import type { Database } from 'better-sqlite3';
import Sqlite3Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { DatabaseConnection } from '../../../types/database/index.ts';

/**
 * SQLite データベース接続の実装
 */
export class SqliteConnection implements DatabaseConnection {
  private db: Database;
  private inTransaction = false;

  constructor(dbPath: string) {
    const fullPath = path.resolve(dbPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Sqlite3Database(fullPath);

    // WAL モードを有効にしてパフォーマンスを向上
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
  }

  async all<T = unknown>(query: string, params: unknown[] = []): Promise<T[]> {
    try {
      const stmt = this.db.prepare(query);
      return stmt.all(params) as T[];
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async get<T = unknown>(query: string, params: unknown[] = []): Promise<T | undefined> {
    try {
      const stmt = this.db.prepare(query);
      return stmt.get(params) as T | undefined;
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async run(query: string, params: unknown[] = []): Promise<{ lastInsertRowid?: number | bigint; changes: number; }> {
    try {
      const stmt = this.db.prepare(query);
      const result = stmt.run(params);
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.changes,
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transaction<T>(callback: () => Promise<T> | T): Promise<T> {
    if (this.inTransaction) {
      // 既にトランザクション内の場合はネストせずに実行
      return await callback();
    }

    const txn = this.db.transaction(callback);
    this.inTransaction = true;

    try {
      const result = txn();
      this.inTransaction = false;
      return result;
    } catch (error) {
      this.inTransaction = false;
      throw error;
    }
  }

  async exec(query: string): Promise<void> {
    try {
      this.db.exec(query);
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    try {
      await this.db.close();
    } catch (error) {
      throw new Error(`Failed to close database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * SQLite 固有のバックアップ機能
   */
  async backup(destinationPath: string): Promise<void> {
    try {
      // better-sqlite3のbackupは既にPromiseを返すので、awaitで待つ
      await this.db.backup(destinationPath);
    } catch (error) {
      throw new Error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * データベースのバキューム（最適化）
   */
  async vacuum(): Promise<void> {
    await this.exec('VACUUM');
  }

  /**
   * データベースのサイズ情報を取得
   */
  async getSize(): Promise<{ totalPages: number; freePages: number; pageSize: number; }> {
    const [totalPages, freePages, pageSize] = await Promise.all([
      this.get<{ count: number; }>('PRAGMA page_count').then(result => result?.count || 0),
      this.get<{ count: number; }>('PRAGMA freelist_count').then(result => result?.count || 0),
      this.get<{ size: number; }>('PRAGMA page_size').then(result => result?.size || 0),
    ]);

    return { totalPages, freePages, pageSize };
  }
}
