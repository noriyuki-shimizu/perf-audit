import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import type { BundleInfo, PerformanceMetrics } from '../types/config.ts';
import type { BuildRecord, TrendData } from '../types/database.ts';

export class PerformanceDatabase {
  private db: Database.Database;

  constructor(dbPath: string = '.perf-audit/performance.db') {
    const fullPath = path.resolve(dbPath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(fullPath);
    this.initSchema();
  }

  private initSchema(): void {
    // Create tables
    this.db.exec(`
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
        FOREIGN KEY (build_id) REFERENCES builds (id)
      );

      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id INTEGER NOT NULL,
        metric_name TEXT NOT NULL,
        value REAL NOT NULL,
        FOREIGN KEY (build_id) REFERENCES builds (id)
      );

      CREATE TABLE IF NOT EXISTS recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        build_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        impact TEXT NOT NULL DEFAULT 'medium',
        FOREIGN KEY (build_id) REFERENCES builds (id)
      );

      CREATE INDEX IF NOT EXISTS idx_builds_timestamp ON builds (timestamp);
      CREATE INDEX IF NOT EXISTS idx_bundles_build_id ON bundles (build_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_build_id ON metrics (build_id);
    `);
  }

  saveBuild(data: {
    timestamp: string;
    branch?: string;
    commitHash?: string;
    url?: string;
    device?: string;
    bundles: BundleInfo[];
    metrics?: PerformanceMetrics;
    recommendations: string[];
  }): number {
    const insertBuild = this.db.prepare(`
      INSERT INTO builds (timestamp, branch, commit_hash, url, device)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertBundle = this.db.prepare(`
      INSERT INTO bundles (build_id, name, size, gzip_size)
      VALUES (?, ?, ?, ?)
    `);

    const insertMetric = this.db.prepare(`
      INSERT INTO metrics (build_id, metric_name, value)
      VALUES (?, ?, ?)
    `);

    const insertRecommendation = this.db.prepare(`
      INSERT INTO recommendations (build_id, type, message)
      VALUES (?, ?, ?)
    `);

    const transaction = this.db.transaction((data: any) => {
      const result = insertBuild.run(
        data.timestamp,
        data.branch || null,
        data.commitHash || null,
        data.url || null,
        data.device || null,
      );
      const buildId = result.lastInsertRowid as number;

      // Save bundles
      for (const bundle of data.bundles) {
        insertBundle.run(buildId, bundle.name, bundle.size, bundle.gzipSize || null);
      }

      // Save metrics
      if (data.metrics) {
        insertMetric.run(buildId, 'performance_score', data.metrics.performance);
        insertMetric.run(buildId, 'accessibility_score', data.metrics.accessibility || 0);
        insertMetric.run(buildId, 'best_practices_score', data.metrics.bestPractices || 0);
        insertMetric.run(buildId, 'seo_score', data.metrics.seo || 0);

        if (data.metrics.metrics) {
          insertMetric.run(buildId, 'fcp', data.metrics.metrics.fcp);
          insertMetric.run(buildId, 'lcp', data.metrics.metrics.lcp);
          insertMetric.run(buildId, 'cls', data.metrics.metrics.cls);
          insertMetric.run(buildId, 'tti', data.metrics.metrics.tti);
        }
      }

      // Save recommendations
      for (const recommendation of data.recommendations) {
        insertRecommendation.run(buildId, 'performance', recommendation);
      }

      return buildId;
    });

    return transaction(data);
  }

  getTrendData(days: number = 30): TrendData[] {
    const query = `
      SELECT 
        DATE(b.timestamp) as date,
        SUM(bu.size) as totalSize,
        SUM(bu.gzip_size) as gzipSize,
        MAX(CASE WHEN m.metric_name = 'performance_score' THEN m.value END) as performanceScore,
        MAX(CASE WHEN m.metric_name = 'fcp' THEN m.value END) as fcp,
        MAX(CASE WHEN m.metric_name = 'lcp' THEN m.value END) as lcp,
        MAX(CASE WHEN m.metric_name = 'cls' THEN m.value END) as cls,
        MAX(CASE WHEN m.metric_name = 'tti' THEN m.value END) as tti
      FROM builds b
      LEFT JOIN bundles bu ON b.id = bu.build_id
      LEFT JOIN metrics m ON b.id = m.build_id
      WHERE b.timestamp > datetime('now', '-${days} days')
      GROUP BY DATE(b.timestamp)
      ORDER BY date DESC
    `;

    return this.db.prepare(query).all() as TrendData[];
  }

  getRecentBuilds(limit: number = 10): (BuildRecord & { bundles: BundleInfo[]; recommendations: string[]; })[] {
    const query = `
      SELECT id, timestamp, branch, commit_hash as commitHash, url, device
      FROM builds
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const builds = this.db.prepare(query).all(limit) as BuildRecord[];

    return builds.map(build => ({
      ...build,
      bundles: this.getBundlesForBuild(build.id),
      recommendations: this.getRecommendationsForBuild(build.id),
    }));
  }

  getBuild(buildId: number): (BuildRecord & { bundles: BundleInfo[]; recommendations: string[]; }) | null {
    const query = `
      SELECT id, timestamp, branch, commit_hash as commitHash, url, device
      FROM builds
      WHERE id = ?
    `;

    const build = this.db.prepare(query).get(buildId) as BuildRecord | undefined;

    if (!build) {
      return null;
    }

    return {
      ...build,
      bundles: this.getBundlesForBuild(build.id),
      recommendations: this.getRecommendationsForBuild(build.id),
    };
  }

  private getBundlesForBuild(buildId: number): BundleInfo[] {
    const query = `
      SELECT name, size, gzip_size as gzipSize
      FROM bundles
      WHERE build_id = ?
      ORDER BY size DESC
    `;

    return this.db.prepare(query).all(buildId).map((bundle: any) => ({
      ...bundle,
      gzipSize: bundle.gzipSize || undefined,
      status: 'ok' as const, // Default status since we don't store it in DB
    }));
  }

  private getRecommendationsForBuild(buildId: number): string[] {
    const query = `
      SELECT message
      FROM recommendations
      WHERE build_id = ?
    `;

    return this.db.prepare(query).all(buildId).map((rec: any) => rec.message);
  }

  getBuildComparison(buildId1: number, buildId2: number): {
    build1: any;
    build2: any;
    bundleDiff: any[];
    metricDiff: any[];
  } {
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

    const build1 = this.db.prepare(getBuildQuery).get(buildId1) as any;
    const build2 = this.db.prepare(getBuildQuery).get(buildId2) as any;

    // Parse and compare bundles
    const bundleDiff: any[] = [];
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

    // Parse and compare metrics
    const metricDiff: any[] = [];
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

    return {
      build1,
      build2,
      bundleDiff,
      metricDiff,
    };
  }

  private parseBundles(bundlesStr: string): Map<string, { size: number; gzipSize: number; }> {
    const bundles = new Map();
    if (!bundlesStr) return bundles;

    bundlesStr.split(',').forEach(item => {
      const [name, size, gzipSize] = item.split(':');
      bundles.set(name, {
        size: parseInt(size),
        gzipSize: parseInt(gzipSize) || 0,
      });
    });

    return bundles;
  }

  private parseMetrics(metricsStr: string): Map<string, number> {
    const metrics = new Map();
    if (!metricsStr) return metrics;

    metricsStr.split(',').forEach(item => {
      const [name, value] = item.split(':');
      metrics.set(name, parseFloat(value));
    });

    return metrics;
  }

  cleanup(retentionDays: number): number {
    const deleteQuery = `
      DELETE FROM builds 
      WHERE timestamp < datetime('now', '-${retentionDays} days')
    `;

    const result = this.db.prepare(deleteQuery).run();
    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
