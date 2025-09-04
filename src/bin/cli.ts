#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeCommand } from '../commands/analyze.js';
import { budgetCommand } from '../commands/budget.js';
import { cleanCommand } from '../commands/clean.js';
import { dashboardCommand } from '../commands/dashboard.js';
import { historyCommand } from '../commands/history.js';
import { initCommand } from '../commands/init.js';
import { lighthouseCommand } from '../commands/lighthouse.js';
import { watchCommand } from '../commands/watch.js';
import { Logger } from '../utils/logger.js';

const program = new Command();

program
  .name('perf-audit')
  .description('CLI tool for continuous performance monitoring and analysis')
  .version('1.0.0');

// Initialize command
program
  .command('init')
  .description('Initialize perf-audit configuration')
  .action(initCommand);

// Analyze command
program
  .command('analyze')
  .description('Analyze bundle size and performance')
  .option('--format <type>', 'Output format (json, html, console)', 'console')
  .option('--compare <branch>', 'Compare with specified branch')
  .option('--details', 'Show detailed analysis')
  .action(analyzeCommand);

// Budget command
program
  .command('budget')
  .description('Check performance budget')
  .option('--format <type>', 'Output format (json, console)', 'console')
  .action(budgetCommand);

// Lighthouse command
program
  .command('lighthouse <url>')
  .description('Run Lighthouse performance audit')
  .option('--device <type>', 'Device type (mobile, desktop)', 'mobile')
  .option('--no-throttling', 'Disable network throttling')
  .option('--format <type>', 'Output format (json, console)', 'console')
  .action((url, options) => {
    lighthouseCommand(url, {
      device: options.device,
      throttling: !options.noThrottling,
      format: options.format,
    });
  });

// History command
program
  .command('history')
  .description('Show performance history and trends')
  .option('--days <n>', 'Number of days to show', '30')
  .option('--metric <type>', 'Show specific metric trend')
  .option('--format <type>', 'Output format (json, console)', 'console')
  .action(options => {
    historyCommand({
      days: parseInt(options.days),
      metric: options.metric,
      format: options.format,
    });
  });

// Watch command
program
  .command('watch')
  .description('Watch for changes and analyze performance in real-time')
  .option('--interval <ms>', 'Debounce interval in milliseconds', '1000')
  .option('--threshold <kb>', 'Size change threshold in KB', '5')
  .option('--notify', 'Enable notifications')
  .option('--silent', 'Reduce output verbosity')
  .action(options => {
    watchCommand({
      interval: parseInt(options.interval),
      threshold: parseInt(options.threshold),
      notify: options.notify,
      silent: options.silent,
    });
  });

// Dashboard command
program
  .command('dashboard')
  .description('Start web dashboard for performance visualization')
  .option('--port <n>', 'Port to run dashboard on', '3000')
  .option('--host <host>', 'Host to bind dashboard to', 'localhost')
  .option('--open', 'Open dashboard in browser automatically')
  .action(options => {
    dashboardCommand({
      port: parseInt(options.port),
      host: options.host,
      open: options.open,
    });
  });

// Clean command
program
  .command('clean')
  .description('Clean performance data and reports')
  .option('--days <n>', 'Delete data older than N days (default: 30)')
  .option('--all', 'Delete all performance data')
  .option('--force', 'Skip confirmation prompt')
  .action(options => {
    cleanCommand({
      days: options.days ? parseInt(options.days) : undefined,
      all: options.all,
      force: options.force,
    });
  });

// Global error handling
program.exitOverride(err => {
  if (err.code === 'commander.unknownCommand') {
    Logger.error(`Unknown command: ${err.message}`);
    program.help();
    process.exit(1);
  }
  // Let help and version commands exit normally
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }
  process.exit(1);
});

// Parse arguments
try {
  program.parse();
} catch (error) {
  Logger.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
