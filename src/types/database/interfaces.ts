/**
 * データベース接続の抽象化インターフェース
 */
export interface DatabaseConnection {
  /**
   * クエリを実行し、複数の結果を返す
   */
  all<T = unknown>(query: string, params?: unknown[]): Promise<T[]>;

  /**
   * クエリを実行し、単一の結果を返す
   */
  get<T = unknown>(query: string, params?: unknown[]): Promise<T | undefined>;

  /**
   * INSERT/UPDATE/DELETE を実行し、実行結果を返す
   */
  run(query: string, params?: unknown[]): Promise<{ lastInsertRowid?: number | bigint; changes: number; }>;

  /**
   * トランザクションを実行
   */
  transaction<T>(callback: () => Promise<T> | T): Promise<T>;

  /**
   * 複数のクエリを一括実行
   */
  exec(query: string): Promise<void>;

  /**
   * 接続を閉じる
   */
  close(): Promise<void>;
}

/**
 * データベース設定
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'mysql' | 'postgresql';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  options?: Record<string, unknown>;
}

/**
 * クエリビルダーのインターフェース
 */
export interface QueryBuilder {
  select(columns: string[]): QueryBuilder;
  from(table: string): QueryBuilder;
  where(condition: string, params?: unknown[]): QueryBuilder;
  join(table: string, condition: string): QueryBuilder;
  leftJoin(table: string, condition: string): QueryBuilder;
  orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder;
  limit(count: number): QueryBuilder;
  groupBy(columns: string[]): QueryBuilder;
  build(): { query: string; params: unknown[]; };
}

/**
 * 移行(Migration)のインターフェース
 */
export interface Migration {
  version: number;
  name: string;
  up(db: DatabaseConnection): Promise<void>;
  down(db: DatabaseConnection): Promise<void>;
}
