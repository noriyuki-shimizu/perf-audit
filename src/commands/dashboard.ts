import cors from 'cors';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { PerformanceDatabase } from '../core/database.ts';
import type { DashboardOptions } from '../types/commands.ts';
import { loadConfig } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';
import { formatSize } from '../utils/size.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        // Try to open in default browser
        // Use localhost if host is 0.0.0.0 (which binds to all interfaces)
        const openUrl = options.host === '0.0.0.0'
          ? `http://localhost:${options.port}`
          : `http://${options.host}:${options.port}`;

        import('open').then(open => {
          Logger.info(`Opening browser: ${openUrl}`);
          open.default(openUrl);
        }).catch(() => {
          Logger.warn('Could not open browser automatically');
        });
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

function setupAPIRoutes(app: express.Application, config: any): void {
  const db = new PerformanceDatabase();

  // Get recent builds
  app.get('/api/builds', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const builds = db.getRecentBuilds(limit);
      res.json(builds);
    } catch {
      res.status(500).json({ error: 'Failed to fetch builds' });
    }
  });

  // Get build by ID
  app.get('/api/builds/:id', (req, res) => {
    try {
      const build = db.getBuild(parseInt(req.params.id));
      if (!build) {
        return res.status(404).json({ error: 'Build not found' });
      }
      res.json(build);
    } catch {
      res.status(500).json({ error: 'Failed to fetch build' });
    }
  });

  // Get bundle trends
  app.get('/api/trends', (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const trends = getBundleTrends(db, days);
      res.json(trends);
    } catch {
      res.status(500).json({ error: 'Failed to fetch trends' });
    }
  });

  // Get bundle comparison
  app.get('/api/compare/:id1/:id2', (req, res) => {
    try {
      const comparison = db.getBuildComparison(parseInt(req.params.id1), parseInt(req.params.id2));
      res.json(comparison);
    } catch {
      res.status(500).json({ error: 'Failed to compare builds' });
    }
  });

  // Get dashboard stats
  app.get('/api/stats', (_, res) => {
    try {
      const stats = getDashboardStats(db);
      res.json(stats);
    } catch {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Get configuration
  app.get('/api/config', (_, res) => {
    res.json({
      budgets: config.budgets,
      analysis: config.analysis,
      reports: config.reports,
    });
  });
}

function setupWebSocket(wss: WebSocketServer): void {
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
}

function getBundleTrends(db: PerformanceDatabase, days: number) {
  const builds = db.getRecentBuilds(days * 4); // Approximate builds per day

  if (builds.length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = builds.map(build => new Date(build.timestamp).toLocaleDateString());
  const bundleNames = [...new Set(builds.flatMap(build => build.bundles.map(b => b.name)))];

  const datasets = bundleNames.map(name => {
    const data = builds.map(build => {
      const bundle = build.bundles.find(b => b.name === name);
      return bundle ? bundle.size : 0;
    });

    return {
      label: name,
      data,
      borderColor: getRandomColor(),
      backgroundColor: getRandomColor(0.1),
      fill: false,
    };
  });

  return { labels, datasets };
}

function getDashboardStats(db: PerformanceDatabase) {
  const recentBuilds = db.getRecentBuilds(30);

  if (recentBuilds.length === 0) {
    return {
      totalBuilds: 0,
      averageSize: 0,
      lastBuildStatus: 'unknown',
      trendsCount: 0,
    };
  }

  const totalBuilds = recentBuilds.length;
  const totalSizes = recentBuilds.map(build => build.bundles.reduce((sum, bundle) => sum + bundle.size, 0));
  const averageSize = totalSizes.reduce((sum, size) => sum + size, 0) / totalSizes.length;
  const lastBuild = recentBuilds[0];
  const lastBuildStatus = getBuildStatus(lastBuild);

  return {
    totalBuilds,
    averageSize: Math.round(averageSize),
    lastBuildStatus,
    trendsCount: recentBuilds.length,
    formattedAverageSize: formatSize(averageSize),
  };
}

function getBuildStatus(build: any): 'ok' | 'warning' | 'error' {
  const hasError = build.bundles.some((b: any) => b.status === 'error');
  const hasWarning = build.bundles.some((b: any) => b.status === 'warning');

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'ok';
}

function getRandomColor(alpha = 1): string {
  const colors = [
    `rgba(255, 99, 132, ${alpha})`,
    `rgba(54, 162, 235, ${alpha})`,
    `rgba(255, 205, 86, ${alpha})`,
    `rgba(75, 192, 192, ${alpha})`,
    `rgba(153, 102, 255, ${alpha})`,
    `rgba(255, 159, 64, ${alpha})`,
    `rgba(199, 199, 199, ${alpha})`,
    `rgba(83, 102, 255, ${alpha})`,
  ];

  return colors[Math.floor(Math.random() * colors.length)];
}
