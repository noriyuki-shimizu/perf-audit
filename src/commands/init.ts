import fs from 'fs';
import path from 'path';
import { generateConfigFile } from '../utils/config.ts';
import { Logger } from '../utils/logger.ts';

/**
 * Initialize performance audit configuration and directories
 * @returns Promise that resolves when initialization is complete
 */
export async function initCommand(): Promise<void> {
  Logger.section('Initializing Performance Audit CLI...');

  const configPath = path.join(process.cwd(), 'perf-audit.config.js');

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    Logger.warn(`Configuration file already exists: ${configPath}`);
    return;
  }

  try {
    // Generate configuration file
    generateConfigFile(configPath);
    Logger.success('Configuration file created successfully');

    // Add to .gitignore if it exists
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      if (!gitignoreContent.includes('.perf-audit/')) {
        fs.appendFileSync(gitignorePath, '\n# Performance Audit data\n.perf-audit/\nperformance-reports/\n');
        Logger.success('Added entries to .gitignore');
      }
    }

    // Create directories
    const reportsDir = path.join(process.cwd(), 'performance-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
      Logger.success('Created reports directory');
    }

    const dataDir = path.join(process.cwd(), '.perf-audit');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      Logger.success('Created data directory');
    }

    Logger.complete('Performance Audit CLI initialized successfully!');
    Logger.nextSteps('Next steps:', [
      'Edit perf-audit.config.js to match your project setup',
      'Run perf-audit analyze to start analyzing your bundle',
      'Run perf-audit budget to check performance budgets',
    ]);
  } catch (error) {
    Logger.error('Failed to initialize', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
}
