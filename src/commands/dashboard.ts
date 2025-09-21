import cors from 'cors';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { PerformanceDatabaseService } from '../core/database/index.ts';
import type { Build, BundleStats, DashboardOptions, DashboardStats, TrendData, TrendQuery } from '../types/commands.ts';
import type { BundleInfo, PerfAuditConfig } from '../types/config.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';
import { formatSize, normalizeSize } from '../utils/size.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start the performance dashboard server
 * @param options - Dashboard configuration options
 */
export async function dashboardCommand(options: DashboardOptions): Promise<void> {
  Logger.section('Starting Performance Dashboard...');

  try {
    const config = await loadConfig();
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server });

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../dashboard/public')));

    // API Routes
    setupAPIRoutes(app, config);

    // WebSocket for real-time updates
    setupWebSocket(wss);

    // Serve dashboard HTML
    app.get('/', (_, res) => {
      res.sendFile(path.join(__dirname, '../dashboard/public/index.html'));
    });

    // Start server
    server.listen(options.port, options.host, () => {
      Logger.success(`Dashboard running at http://${options.host}:${options.port}`);
      Logger.info('Open in your browser to view performance metrics');

      if (options.open) {
        openBrowser(options.host, options.port);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      Logger.info('Shutting down dashboard...');
      server.close(() => {
        process.exit(0);
      });
    });
  } catch (error) {
    Logger.error(`Failed to start dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Open browser automatically
 * @param host - Server host
 * @param port - Server port
 */
const openBrowser = (host: string, port: number): void => {
  // Use localhost if host is 0.0.0.0 (which binds to all interfaces)
  const openUrl = host === '0.0.0.0'
    ? `http://localhost:${port}`
    : `http://${host}:${port}`;

  import('open').then(open => {
    Logger.info(`Opening browser: ${openUrl}`);
    open.default(openUrl);
  }).catch(() => {
    Logger.warn('Could not open browser automatically');
  });
};

/**
 * Setup API routes for the dashboard
 * @param app - Express application
 * @param config - Application configuration
 */
const setupAPIRoutes = async (app: express.Application, config: PerfAuditConfig): Promise<void> => {
  const db = await PerformanceDatabaseService.instance();

  app.get('/api/builds', handleGetBuilds(db));
  app.get('/api/builds/:id', handleGetBuild(db));
  app.get('/api/compare/:id1/:id2', handleCompareBuild(db));
  app.get('/api/stats', handleGetStats(db));
  app.get('/api/config', handleGetConfig(config));
  app.get('/api/trends/client', handleGetClientTrends(db));
  app.get('/api/trends/server', handleGetServerTrends(db));
  app.get('/api/trends/total', handleGetTotalTrends(db));
};

/**
 * Handle get recent builds request
 * @param db - Performance database instance
 */
const handleGetBuilds =
  (db: PerformanceDatabaseService) => async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const builds = await db.getRecentBuilds({ limit, orderBy: 'DESC' });
      res.json(builds);
    } catch {
      res.status(500).json({ error: 'Failed to fetch builds' });
    }
  };

/**
 * Handle get build by ID request
 * @param db - Performance database instance
 */
const handleGetBuild =
  (db: PerformanceDatabaseService) => async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const build = await db.getBuild(parseInt(req.params.id));
      if (!build) {
        res.status(404).json({ error: 'Build not found' });
        return;
      }
      res.json(build);
    } catch {
      res.status(500).json({ error: 'Failed to fetch build' });
    }
  };

/**
 * Handle build comparison request
 * @param db - Performance database instance
 */
const handleCompareBuild =
  (db: PerformanceDatabaseService) => async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const comparison = await db.getBuildComparison(parseInt(req.params.id1), parseInt(req.params.id2));
      res.json(comparison);
    } catch {
      res.status(500).json({ error: 'Failed to compare builds' });
    }
  };

/**
 * Handle dashboard stats request
 * @param db - Performance database instance
 */
const handleGetStats =
  (db: PerformanceDatabaseService) => async (_: express.Request, res: express.Response): Promise<void> => {
    try {
      const stats = await getDashboardStats(db);
      res.json(stats);
    } catch {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  };

/**
 * Handle configuration request
 * @param config - Application configuration
 */
const handleGetConfig = (config: PerfAuditConfig) => (_: express.Request, res: express.Response): void => {
  res.json({
    budgets: config.budgets,
    analysis: config.analysis,
    reports: config.reports,
  });
};

/**
 * Handle client trends request
 * @param db - Performance database instance
 */
const handleGetClientTrends =
  (db: PerformanceDatabaseService) => async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const query = validateTrendQuery(req.query);
      const builds = await getFilteredBuilds(db, query);
      const clientTrends = await getClientTotalTrends(builds);
      res.json(clientTrends);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch client trends';
      res.status(500).json({ error: `Failed to fetch client trends: ${message}` });
    }
  };

/**
 * Handle server trends request
 * @param db - Performance database instance
 */
const handleGetServerTrends =
  (db: PerformanceDatabaseService) => async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const query = validateTrendQuery(req.query);
      const builds = await getFilteredBuilds(db, query);
      const serverTrends = await getServerTotalTrends(builds);
      res.json(serverTrends);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch server trends';
      res.status(500).json({ error: message });
    }
  };

/**
 * Handle total trends request
 * @param db - Performance database instance
 */
const handleGetTotalTrends =
  (db: PerformanceDatabaseService) => async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const query = validateTrendQuery(req.query);
      const builds = await getFilteredBuilds(db, query);
      const totalTrends = await getTotalBundleTrends(builds);
      res.json(totalTrends);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch total trends';
      res.status(500).json({ error: message });
    }
  };

/**
 * Validate trend query parameters
 * @param query - Express query object
 * @returns Validated query parameters
 */
const validateTrendQuery = (query: express.Request['query']): TrendQuery => {
  if (typeof query.days !== 'string' && query.days !== undefined) {
    throw new Error('Invalid query parameters ["days"]');
  }
  if (
    (typeof query.startDate !== 'string' && query.startDate !== undefined)
    || (typeof query.endDate !== 'string' && query.endDate !== undefined)
  ) {
    throw new Error('Invalid query parameters ["startDate", "endDate"]');
  }

  return {
    days: parseInt(query.days ?? '30', 10),
    startDate: query.startDate !== undefined ? `${query.startDate} 00:00:00` : undefined,
    endDate: query.endDate !== undefined ? `${query.endDate} 23:59:59` : undefined,
  };
};

/**
 * Setup WebSocket for real-time updates
 * @param wss - WebSocket server instance
 */
const setupWebSocket = (wss: WebSocketServer): void => {
  wss.on('connection', ws => {
    Logger.debug('WebSocket client connected');

    ws.on('message', message => {
      try {
        const data = JSON.parse(message.toString());

        // Handle different message types
        switch (data.type) {
          case 'subscribe':
            // Subscribe to real-time updates
            ws.send(JSON.stringify({
              type: 'subscribed',
              message: 'Subscribed to performance updates',
            }));
            break;
        }
      } catch (error) {
        Logger.error(`WebSocket message error: ${error}`);
      }
    });

    ws.on('close', () => {
      Logger.debug('WebSocket client disconnected');
    });
  });
};

/**
 * Get dashboard statistics
 * @param db - Performance database instance
 * @returns Dashboard statistics
 */
const getDashboardStats = async (db: PerformanceDatabaseService): Promise<DashboardStats> => {
  const recentBuilds = await db.getRecentBuilds({ limit: 30, orderBy: 'ASC' });

  if (recentBuilds.length === 0) {
    return createEmptyStats();
  }

  const totalBuilds = recentBuilds.length;
  const totalSizes = recentBuilds.map(build => build.bundles.reduce((sum, bundle) => sum + bundle.size, 0));
  const averageSize = totalSizes.reduce((sum, size) => sum + size, 0) / totalSizes.length;
  const lastBuild = recentBuilds[0];
  const lastTimestamp = lastBuild.timestamp;
  const lastBuildStatus = getBuildStatus(lastBuild);

  const { clientStats, serverStats } = calculateBundleStats(recentBuilds, lastTimestamp);

  return {
    totalBuilds,
    averageSize: Math.round(averageSize),
    lastBuildStatus,
    trendsCount: recentBuilds.length,
    formattedAverageSize: formatSize(averageSize),
    clientStats: {
      ...clientStats,
      formattedTotalSize: formatSize(clientStats.totalSize),
      formattedAverageSize: formatSize(clientStats.averageSize),
    },
    serverStats: {
      ...serverStats,
      formattedTotalSize: formatSize(serverStats.totalSize),
      formattedAverageSize: formatSize(serverStats.averageSize),
    },
  };
};

/**
 * Create empty dashboard statistics
 * @returns Empty dashboard statistics
 */
const createEmptyStats = (): DashboardStats => ({
  totalBuilds: 0,
  averageSize: 0,
  lastBuildStatus: 'ok',
  trendsCount: 0,
  clientStats: { totalSize: 0, averageSize: 0, bundleCount: 0, formattedTotalSize: '0B', formattedAverageSize: '0B' },
  serverStats: { totalSize: 0, averageSize: 0, bundleCount: 0, formattedTotalSize: '0B', formattedAverageSize: '0B' },
});

/**
 * Calculate bundle statistics for client and server
 * @param builds - Recent builds data
 * @param lastTimestamp - Timestamp of the last build
 * @returns Client and server bundle statistics
 */
const calculateBundleStats = (builds: Build[], lastTimestamp: string): {
  clientStats: BundleStats;
  serverStats: BundleStats;
} => {
  const lastBuildBundles = builds
    .filter(build => build.timestamp === lastTimestamp)
    .flatMap(build => build.bundles);

  const clientBundles = lastBuildBundles.filter(b => b.type === 'client');
  const serverBundles = lastBuildBundles.filter(b => b.type === 'server');

  const clientStats = calculateStatsForBundles(clientBundles);
  const serverStats = calculateStatsForBundles(serverBundles);

  return { clientStats, serverStats };
};

/**
 * Calculate statistics for bundle array
 * @param bundles - Array of bundles
 * @returns Bundle statistics
 */
const calculateStatsForBundles = (bundles: BundleInfo[]): BundleStats => {
  const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);
  const averageSize = bundles.length > 0 ? Math.round(totalSize / bundles.length) : 0;

  return {
    totalSize,
    averageSize,
    bundleCount: bundles.length,
  };
};

/**
 * Get build status based on bundle statuses
 * @param build - Build data
 * @returns Build status
 */
const getBuildStatus = (build: Build): 'ok' | 'warning' | 'error' => {
  const hasError = build.bundles.some((b: BundleInfo) => b.status === 'error');
  const hasWarning = build.bundles.some((b: BundleInfo) => b.status === 'warning');

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'ok';
};

/**
 * Get filtered builds based on date range
 * @param db - Performance database instance
 * @param param - Filter parameters
 * @returns Filtered builds array
 */
const getFilteredBuilds = async (
  db: PerformanceDatabaseService,
  param: TrendQuery,
): Promise<Build[]> => {
  return db.getRecentBuilds({
    startDate: param.startDate,
    endDate: param.endDate,
    limit: param.days * 4,
    orderBy: 'ASC',
  });
};

/**
 * Format date for chart labels
 * @param timestamp - ISO timestamp string
 * @returns Formatted date string
 */
const formatDateLabel = (timestamp: string): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

/**
 * Get client-side total bundle size trends
 * @param builds - Array of builds
 * @returns Trend data for client bundles
 */
const getClientTotalTrends = (builds: Build[]): TrendData => {
  if (builds.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = builds.map(build => formatDateLabel(build.timestamp));
  const data = builds.map(build => {
    const clientBundles = build.bundles.filter(b => b.type === 'client');
    const totalSize = clientBundles.reduce((total, bundle) => total + bundle.size, 0);
    return normalizeSize(totalSize);
  });

  return {
    labels,
    datasets: [{
      label: 'クライアントサイド合計バンドルサイズ',
      data,
      borderColor: 'rgba(54, 162, 235, 1)',
      backgroundColor: 'rgba(54, 162, 235, 0.1)',
      fill: false,
    }],
  };
};

/**
 * Get server-side total bundle size trends
 * @param builds - Array of builds
 * @returns Trend data for server bundles
 */
const getServerTotalTrends = (builds: Build[]): TrendData => {
  if (builds.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = builds.map(build => formatDateLabel(build.timestamp));
  const data = builds.map(build => {
    const serverBundles = build.bundles.filter(b => b.type === 'server');
    const totalSize = serverBundles.reduce((total, bundle) => total + bundle.size, 0);
    return normalizeSize(totalSize);
  });

  return {
    labels,
    datasets: [{
      label: 'サーバーサイド合計バンドルサイズ',
      data,
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.1)',
      fill: false,
      borderDash: [],
    }],
  };
};

/**
 * Get total bundle size trends for both client and server
 * @param builds - Array of builds
 * @returns Trend data for both client and server bundles
 */
const getTotalBundleTrends = (builds: Build[]): TrendData => {
  if (builds.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = builds.map(build => formatDateLabel(build.timestamp));

  const clientData = builds.map(build => {
    const clientBundles = build.bundles.filter(b => b.type === 'client');
    const totalSize = clientBundles.reduce((total, bundle) => total + bundle.size, 0);
    return normalizeSize(totalSize);
  });

  const serverData = builds.map(build => {
    const serverBundles = build.bundles.filter(b => b.type === 'server');
    const totalSize = serverBundles.reduce((total, bundle) => total + bundle.size, 0);
    return normalizeSize(totalSize);
  });

  return {
    labels,
    datasets: [
      {
        label: 'クライアントサイド合計',
        data: clientData,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        fill: false,
        borderDash: [],
      },
      {
        label: 'サーバーサイド合計',
        data: serverData,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: false,
        borderDash: [],
      },
    ],
  };
};
