#!/usr/bin/env node

import { Command } from 'commander';
import { analyzeCommand } from '../commands/analyze.ts';
import { budgetCommand } from '../commands/budget.ts';
import { cleanCommand } from '../commands/clean.ts';
import { dashboardCommand } from '../commands/dashboard.ts';
import { historyCommand } from '../commands/history.ts';
import { initCommand } from '../commands/init.ts';
import { lighthouseCommand } from '../commands/lighthouse.ts';
import { watchCommand } from '../commands/watch.ts';
import { DEFAULT_CLI_OPTIONS, DEFAULT_HOST, DEFAULT_PORT } from '../constants/server.ts';
import { Logger } from '../utils/logger.ts';
import { getPackageJson } from '../utils/package.ts';

/** Command line interface for perf-audit */
const program = new Command();

program
  .name('perf-audit')
  .description('CLI tool for continuous performance monitoring and analysis')
  .version(getPackageJson(import.meta.url).version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command')
  .addHelpText(
    'after',
    `
Examples:
  $ perf-audit init                     Initialize configuration file
  $ perf-audit analyze                  Analyze bundle size
  $ perf-audit budget                   Check performance budgets
  $ perf-audit lighthouse <url>         Run Lighthouse audit
  $ perf-audit history                  Show performance trends
  $ perf-audit watch                    Watch for changes
  $ perf-audit dashboard                Start web dashboard
  $ perf-audit clean                    Clean old data

For more information, visit: https://github.com/noriyuki-shimizu/perf-audit`,
  );

// Initialize command
program
  .command('init')
  .description('Initialize perf-audit configuration')
  .action(initCommand);

// Analyze command
program
  .command('analyze')
  .description('Analyze bundle size and performance')
  .option('--format <type>', 'Output format (json, html, console)', DEFAULT_CLI_OPTIONS.OUTPUT_FORMAT)
  .option('--compare <branch>', 'Compare with specified branch')
  .option('--details', 'Show detailed analysis')
  .action(analyzeCommand);

// Budget command
program
  .command('budget')
  .description('Check performance budget')
  .option('--format <type>', 'Output format (json, console)', DEFAULT_CLI_OPTIONS.OUTPUT_FORMAT)
  .action(budgetCommand);

// Lighthouse command
program
  .command('lighthouse <url>')
  .description('Run Lighthouse performance audit')
  .option('--device <type>', 'Device type (mobile, desktop)', DEFAULT_CLI_OPTIONS.LIGHTHOUSE_DEVICE)
  .option('--no-throttling', 'Disable network throttling')
  .option('--format <type>', 'Output format (json, console)', DEFAULT_CLI_OPTIONS.OUTPUT_FORMAT)
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
  .option('--days <n>', 'Number of days to show', DEFAULT_CLI_OPTIONS.HISTORY_DAYS)
  .option('--format <type>', 'Output format (json, console)', DEFAULT_CLI_OPTIONS.OUTPUT_FORMAT)
  .action(options => {
    historyCommand({
      days: parseInt(options.days),
      format: options.format,
    });
  });

// Watch command
program
  .command('watch')
  .description('Watch for changes and analyze performance in real-time')
  .option('--interval <ms>', 'Debounce interval in milliseconds', DEFAULT_CLI_OPTIONS.WATCH_INTERVAL)
  .option('--threshold <kb>', 'Size change threshold in KB', DEFAULT_CLI_OPTIONS.WATCH_THRESHOLD)
  .option('--notify', 'Enable notifications')
  .option('--silent', 'Reduce output verbosity')
  .action(options => {
    watchCommand({
      interval: parseInt(options.interval),
      notify: options.notify,
      silent: options.silent,
    });
  });

// Dashboard command
program
  .command('dashboard')
  .description('Start web dashboard for performance visualization')
  .option('--port <n>', 'Port to run dashboard on', DEFAULT_PORT.toString())
  .option('--host <host>', 'Host to bind dashboard to', DEFAULT_HOST)
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
