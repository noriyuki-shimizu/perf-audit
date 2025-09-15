import type { BundleDiff } from '../../../types/bundle.ts';
import type { BundleInfo } from '../../../types/config.ts';
import type {
  BuildBundleMetricRecord,
  BuildRecord,
  BuildRepository,
  BundleRepository,
  DatabaseConnection,
  MetricRepository,
  NewBuildRecord,
  RecommendationRepository,
  Repository,
  TrendData,
} from '../../../types/database/index.ts';
import type { MetricDiff } from '../../../types/metric.ts';

/**
 * SQLite Build Repository 実装
 */
export class SqliteBuildRepository implements BuildRepository {
  constructor(private db: DatabaseConnection) {}

  async create(data: Omit<NewBuildRecord, 'bundles' | 'metrics' | 'recommendations'>): Promise<number | bigint> {
    const query = `
      INSERT INTO builds (timestamp, branch, commit_hash, url, device)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(query, [
      data.timestamp,
      data.branch || null,
      data.commitHash || null,
      data.url || null,
      data.device || null,
    ]);

    return result.lastInsertRowid!;
  }

  findById(id: number): Promise<BuildRecord | undefined> {
    const query = `
      SELECT id, timestamp, branch, commit_hash as commitHash, url, device
      FROM builds
      WHERE id = ?
    `;

    return this.db.get<BuildRecord>(query, [id]);
  }

  findRecent(limit = 10, orderBy: 'ASC' | 'DESC' = 'DESC'): Promise<BuildRecord[]> {
    const query = `
      SELECT id, timestamp, branch, commit_hash as commitHash, url, device
      FROM builds
      ORDER BY timestamp ${orderBy}
      LIMIT ?
    `;

    return this.db.all<BuildRecord>(query, [limit]);
  }

  findByDateRange(startDate: string, endDate: string): Promise<BuildRecord[]> {
    const query = `
      SELECT id, timestamp, branch, commit_hash as commitHash, url, device
      FROM builds
      WHERE datetime(timestamp) BETWEEN datetime(?) AND datetime(?)
      ORDER BY timestamp DESC
    `;

    return this.db.all<BuildRecord>(query, [startDate, endDate]);
  }

  getTrendData(days = 30): Promise<TrendData[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString();

    const query = `
      SELECT
        DATE(b.timestamp) as date,
        SUM(bu.size) as totalSize,
        SUM(bu.gzip_size) as gzipSize,
        bu.type as type,
        MAX(CASE WHEN m.metric_name = 'performance_score' THEN m.value END) as performanceScore,
        MAX(CASE WHEN m.metric_name = 'fcp' THEN m.value END) as fcp,
        MAX(CASE WHEN m.metric_name = 'lcp' THEN m.value END) as lcp,
        MAX(CASE WHEN m.metric_name = 'cls' THEN m.value END) as cls,
        MAX(CASE WHEN m.metric_name = 'tti' THEN m.value END) as tti
      FROM builds b
      LEFT JOIN bundles bu ON b.id = bu.build_id
      LEFT JOIN metrics m ON b.id = m.build_id
      WHERE datetime(b.timestamp) > datetime(?)
      GROUP BY DATE(b.timestamp), type
      ORDER BY date ASC
    `;

    return this.db.all<TrendData>(query, [cutoffDateStr]);
  }

  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString();

    await this.db.transaction(async () => {
      const buildIdsQuery = `
        SELECT id FROM builds
        WHERE datetime(timestamp) > datetime(?)
      `;

      const buildIds = await this.db.all<{ id: number; }>(buildIdsQuery, [cutoffDateStr]);

      console.log('buildIds: ', buildIds);
      if (buildIds.length === 0) {
        return;
      }

      const placeholders = buildIds.map(() => '?').join(',');

      await this.db.run(`DELETE FROM recommendations WHERE build_id IN (${placeholders})`, buildIds.map(b => b.id));
      await this.db.run(`DELETE FROM metrics WHERE build_id IN (${placeholders})`, buildIds.map(b => b.id));
      await this.db.run(`DELETE FROM bundles WHERE build_id IN (${placeholders})`, buildIds.map(b => b.id));
    });

    const query = `
      DELETE FROM builds
      WHERE datetime(timestamp) > datetime(?)
    `;

    const result = await this.db.run(query, [cutoffDateStr]);
    return result.changes;
  }

  async getComparison(buildId1: number, buildId2: number): Promise<{
    build1: BuildBundleMetricRecord | undefined;
    build2: BuildBundleMetricRecord | undefined;
    bundleDiff: BundleDiff[];
    metricDiff: MetricDiff[];
  }> {
    const getBuildQuery = `
      SELECT b.*,
        GROUP_CONCAT(bu.name || ':' || bu.size || ':' || COALESCE(bu.gzip_size, 0)) as bundles,
        GROUP_CONCAT(m.metric_name || ':' || m.value) as metrics
      FROM builds b
      LEFT JOIN bundles bu ON b.id = bu.build_id
      LEFT JOIN metrics m ON b.id = m.build_id
      WHERE b.id = ?
      GROUP BY b.id
    `;

    const [build1, build2] = await Promise.all([
      this.db.get<BuildBundleMetricRecord>(getBuildQuery, [buildId1]),
      this.db.get<BuildBundleMetricRecord>(getBuildQuery, [buildId2]),
    ]);

    // バンドル比較
    const bundleDiff: BundleDiff[] = [];
    const bundles1 = this.parseBundles(build1?.bundles || '');
    const bundles2 = this.parseBundles(build2?.bundles || '');

    for (const [name, data1] of bundles1) {
      const data2 = bundles2.get(name);
      if (data2) {
        bundleDiff.push({
          name,
          oldSize: data1.size,
          newSize: data2.size,
          delta: data2.size - data1.size,
          oldGzipSize: data1.gzipSize,
          newGzipSize: data2.gzipSize,
          gzipDelta: (data2.gzipSize || 0) - (data1.gzipSize || 0),
        });
      }
    }

    // メトリクス比較
    const metricDiff: MetricDiff[] = [];
    const metrics1 = this.parseMetrics(build1?.metrics || '');
    const metrics2 = this.parseMetrics(build2?.metrics || '');

    for (const [name, value1] of metrics1) {
      const value2 = metrics2.get(name);
      if (value2 !== undefined) {
        metricDiff.push({
          name,
          oldValue: value1,
          newValue: value2,
          delta: value2 - value1,
        });
      }
    }

    return { build1, build2, bundleDiff, metricDiff };
  }

  private parseBundles(bundlesStr: string): Map<string, { size: number; gzipSize: number; }> {
    const bundles = new Map();
    if (!bundlesStr) return bundles;

    bundlesStr.split(',').forEach(item => {
      const [name, size, gzipSize] = item.split(':');
      if (name && size) {
        bundles.set(name, {
          size: parseInt(size, 10),
          gzipSize: parseInt(gzipSize, 10) || 0,
        });
      }
    });

    return bundles;
  }

  private parseMetrics(metricsStr: string): Map<string, number> {
    const metrics = new Map();
    if (!metricsStr) return metrics;

    metricsStr.split(',').forEach(item => {
      const [name, value] = item.split(':');
      if (name && value) {
        metrics.set(name, parseFloat(value));
      }
    });

    return metrics;
  }
}

/**
 * SQLite Bundle Repository 実装
 */
export class SqliteBundleRepository implements BundleRepository {
  constructor(private db: DatabaseConnection) {}

  async create(buildId: number | bigint, bundle: BundleInfo): Promise<number | bigint> {
    const query = `
      INSERT INTO bundles (build_id, name, size, gzip_size, delta, status, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.run(query, [
      buildId,
      bundle.name,
      bundle.size,
      bundle.gzipSize || null,
      bundle.delta || null,
      bundle.status,
      bundle.type || null,
    ]);

    return result.lastInsertRowid!;
  }

  async createMany(buildId: number | bigint, bundles: BundleInfo[]): Promise<void> {
    await this.db.transaction(async () => {
      for (const bundle of bundles) {
        await this.create(buildId, bundle);
      }
    });
  }

  findByBuildId(buildId: number): Promise<BundleInfo[]> {
    const query = `
      SELECT name, size, gzip_size as gzipSize, delta, status, type
      FROM bundles
      WHERE build_id = ?
      ORDER BY size DESC
    `;

    return this.db.all<BundleInfo>(query, [buildId]);
  }

  findByName(name: string, limit = 10): Promise<(BundleInfo & { buildId: number; })[]> {
    const query = `
      SELECT build_id as buildId, name, size, gzip_size as gzipSize, delta, status, type
      FROM bundles
      WHERE name LIKE ?
      ORDER BY build_id DESC
      LIMIT ?
    `;

    return this.db.all<BundleInfo & { buildId: number; }>(query, [`%${name}%`, limit]);
  }

  findLargeBundles(minSize: number, limit = 10): Promise<(BundleInfo & { buildId: number; })[]> {
    const query = `
      SELECT build_id as buildId, name, size, gzip_size as gzipSize, delta, status, type
      FROM bundles
      WHERE size >= ?
      ORDER BY size DESC
      LIMIT ?
    `;

    return this.db.all<BundleInfo & { buildId: number; }>(query, [minSize, limit]);
  }
}

/**
 * SQLite Metric Repository 実装
 */
export class SqliteMetricRepository implements MetricRepository {
  constructor(private db: DatabaseConnection) {}

  async create(buildId: number | bigint, metricName: string, value: number): Promise<number | bigint> {
    const query = `
      INSERT INTO metrics (build_id, metric_name, value)
      VALUES (?, ?, ?)
    `;

    const result = await this.db.run(query, [buildId, metricName, value]);
    return result.lastInsertRowid!;
  }

  async createMany(buildId: number | bigint, metrics: Array<{ name: string; value: number; }>): Promise<void> {
    await this.db.transaction(async () => {
      for (const metric of metrics) {
        await this.create(buildId, metric.name, metric.value);
      }
    });
  }

  findByBuildId(buildId: number): Promise<Array<{ metricName: string; value: number; }>> {
    const query = `
      SELECT metric_name as metricName, value
      FROM metrics
      WHERE build_id = ?
      ORDER BY metric_name
    `;

    return this.db.all<{ metricName: string; value: number; }>(query, [buildId]);
  }

  findMetricHistory(
    metricName: string,
    days = 30,
  ): Promise<Array<{ buildId: number; value: number; timestamp: string; }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString();

    const query = `
      SELECT m.build_id as buildId, m.value, b.timestamp
      FROM metrics m
      JOIN builds b ON m.build_id = b.id
      WHERE m.metric_name = ?
        AND b.timestamp > ?
      ORDER BY b.timestamp DESC
    `;

    return this.db.all<{ buildId: number; value: number; timestamp: string; }>(query, [metricName, cutoffDateStr]);
  }

  async getMetricStats(metricName: string, days = 30): Promise<{
    average: number;
    min: number;
    max: number;
    count: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString();

    const query = `
      SELECT
        AVG(m.value) as average,
        MIN(m.value) as min,
        MAX(m.value) as max,
        COUNT(m.value) as count
      FROM metrics m
      JOIN builds b ON m.build_id = b.id
      WHERE m.metric_name = ?
        AND b.timestamp > ?
    `;

    const result = await this.db.get<{
      average: number;
      min: number;
      max: number;
      count: number;
    }>(query, [metricName, cutoffDateStr]);

    return result || { average: 0, min: 0, max: 0, count: 0 };
  }
}

/**
 * SQLite Recommendation Repository 実装
 */
export class SqliteRecommendationRepository implements RecommendationRepository {
  constructor(private db: DatabaseConnection) {}

  async create(buildId: number | bigint, type: string, message: string, impact = 'medium'): Promise<number | bigint> {
    const query = `
      INSERT INTO recommendations (build_id, type, message, impact)
      VALUES (?, ?, ?, ?)
    `;

    const result = await this.db.run(query, [buildId, type, message, impact]);
    return result.lastInsertRowid!;
  }

  async createMany(buildId: number | bigint, recommendations: string[], type = 'performance'): Promise<void> {
    await this.db.transaction(async () => {
      for (const recommendation of recommendations) {
        await this.create(buildId, type, recommendation);
      }
    });
  }

  async findByBuildId(buildId: number): Promise<string[]> {
    const query = `
      SELECT message
      FROM recommendations
      WHERE build_id = ?
      ORDER BY id
    `;

    const results = await this.db.all<{ message: string; }>(query, [buildId]);
    return results.map(row => row.message);
  }

  findByType(type: string, limit = 10): Promise<Array<{ buildId: number; message: string; impact: string; }>> {
    const query = `
      SELECT build_id as buildId, message, impact
      FROM recommendations
      WHERE type = ?
      ORDER BY build_id DESC
      LIMIT ?
    `;

    return this.db.all<{ buildId: number; message: string; impact: string; }>(query, [type, limit]);
  }

  findFrequentRecommendations(days = 30, limit = 10): Promise<Array<{ message: string; count: number; }>> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString();

    const query = `
      SELECT r.message, COUNT(*) as count
      FROM recommendations r
      JOIN builds b ON r.build_id = b.id
      WHERE b.timestamp > ?
      GROUP BY r.message
      ORDER BY count DESC
      LIMIT ?
    `;

    return this.db.all<{ message: string; count: number; }>(query, [cutoffDateStr, limit]);
  }
}

/**
 * SQLite Unit of Work 実装
 */
export class SqliteRepository implements Repository {
  public readonly builds: BuildRepository;
  public readonly bundles: BundleRepository;
  public readonly metrics: MetricRepository;
  public readonly recommendations: RecommendationRepository;

  private transactionStarted = false;

  constructor(private db: DatabaseConnection) {
    this.builds = new SqliteBuildRepository(db);
    this.bundles = new SqliteBundleRepository(db);
    this.metrics = new SqliteMetricRepository(db);
    this.recommendations = new SqliteRecommendationRepository(db);
  }

  async initSchema(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS builds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        branch TEXT,
        commit_hash TEXT,
        url TEXT,
        device TEXT
      );

      CREATE TABLE IF NOT EXISTS bundles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        gzip_size INTEGER,
        delta INTEGER,
        status TEXT NOT NULL,
        type TEXT,
        FOREIGN KEY (build_id) REFERENCES builds (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id INTEGER NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        FOREIGN KEY (build_id) REFERENCES builds (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        impact TEXT NOT NULL DEFAULT 'medium',
        FOREIGN KEY (build_id) REFERENCES builds (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_builds_timestamp ON builds (timestamp);
      CREATE INDEX IF NOT EXISTS idx_bundles_build_id ON bundles (build_id);
      CREATE INDEX IF NOT EXISTS idx_bundles_name ON bundles (name);
      CREATE INDEX IF NOT EXISTS idx_bundles_size ON bundles (size);
      CREATE INDEX IF NOT EXISTS idx_metrics_build_id ON metrics (build_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics (metric_name);
      CREATE INDEX IF NOT EXISTS idx_recommendations_build_id ON recommendations (build_id);
      CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations (type);
    `);
  }

  async cleanAll(): Promise<void> {
    await this.db.exec(`
      DELETE FROM builds;
      DELETE FROM bundles;
      DELETE FROM metrics;
      DELETE FROM recommendations;
    `);
  }

  async beginTransaction(): Promise<void> {
    if (!this.transactionStarted) {
      await this.db.exec('BEGIN TRANSACTION');
      this.transactionStarted = true;
    }
  }

  async commit(): Promise<void> {
    if (this.transactionStarted) {
      await this.db.exec('COMMIT');
      this.transactionStarted = false;
    }
  }

  async rollback(): Promise<void> {
    if (this.transactionStarted) {
      await this.db.exec('ROLLBACK');
      this.transactionStarted = false;
    }
  }

  async close(): Promise<void> {
    if (this.transactionStarted) {
      await this.rollback();
    }
    await this.db.close();
  }
}
