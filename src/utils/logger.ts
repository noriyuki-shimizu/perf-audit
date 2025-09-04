import chalk from 'chalk';

// Simple console logger with colors and icons
const formatMessage = (level: string, message: string, meta?: any): string => {
  let formattedMessage = message;

  switch (level) {
    case 'error':
      formattedMessage = `${chalk.red('❌')} ${message}`;
      break;
    case 'warn':
      formattedMessage = `${chalk.yellow('⚠️')} ${message}`;
      break;
    case 'info':
      formattedMessage = `${chalk.blue('ℹ️')} ${message}`;
      break;
    case 'success':
      formattedMessage = `${chalk.green('✅')} ${message}`;
      break;
    case 'debug':
      formattedMessage = `${chalk.gray('🔍')} ${chalk.gray(message)}`;
      break;
    default:
      formattedMessage = message;
  }

  if (meta && Object.keys(meta).length > 0) {
    formattedMessage += ` ${chalk.dim(JSON.stringify(meta))}`;
  }

  return formattedMessage;
};

// Helper methods for common CLI patterns
export class Logger {
  static info(message: string, meta?: any) {
    console.log(formatMessage('info', message, meta));
  }

  static success(message: string, meta?: any) {
    console.log(formatMessage('success', message, meta));
  }

  static warn(message: string, meta?: any) {
    console.log(formatMessage('warn', message, meta));
  }

  static error(message: string, meta?: any) {
    console.log(formatMessage('error', message, meta));
  }

  static debug(message: string, meta?: any) {
    console.log(formatMessage('debug', message, meta));
  }

  // Special methods for CLI operations
  static title(message: string) {
    console.log(chalk.bold.blue(`\n${message}`));
    console.log(chalk.blue('═'.repeat(message.length)));
  }

  static section(message: string) {
    console.log(chalk.bold(`\n📋 ${message}`));
  }

  static table(data: any[]) {
    console.table(data);
  }

  static json(data: any) {
    console.log(JSON.stringify(data, null, 2));
  }

  static raw(message: string) {
    // For cases where we need unformatted output (like JSON)
    console.log(message);
  }

  // Progress indicators
  static progress(message: string, step?: number, total?: number) {
    if (step !== undefined && total !== undefined) {
      const percentage = Math.round((step / total) * 100);
      console.log(formatMessage('info', `${message} [${step}/${total}] (${percentage}%)`));
    } else {
      console.log(formatMessage('info', `🔄 ${message}`));
    }
  }

  // Confirmation and prompts
  static prompt(message: string): string {
    return chalk.yellow(`❓ ${message}`);
  }

  // Summary and results
  static result(
    title: string,
    items: Array<{ label: string; value: string; status?: 'success' | 'warning' | 'error'; }>,
  ) {
    console.log(chalk.bold(`\n📊 ${title}`));
    items.forEach(item => {
      let icon = '•';
      let valueColor = chalk.white;

      switch (item.status) {
        case 'success':
          icon = '✅';
          valueColor = chalk.green;
          break;
        case 'warning':
          icon = '⚠️';
          valueColor = chalk.yellow;
          break;
        case 'error':
          icon = '❌';
          valueColor = chalk.red;
          break;
      }

      console.log(`${icon} ${item.label}: ${valueColor(item.value)}`);
    });
  }

  // Process completion
  static complete(message: string, details?: string[]) {
    console.log(chalk.green.bold(`\n🎉 ${message}`));
    if (details) {
      details.forEach(detail => {
        console.log(chalk.green(`   ${detail}`));
      });
    }
  }

  // Process failure
  static failure(message: string, details?: string[]) {
    console.log(chalk.red.bold(`\n💥 ${message}`));
    if (details) {
      details.forEach(detail => {
        console.log(chalk.red(`   ${detail}`));
      });
    }
  }

  // Next steps or recommendations
  static nextSteps(title: string, steps: string[]) {
    console.log(chalk.blue.bold(`\n💡 ${title}`));
    steps.forEach((step, index) => {
      console.log(chalk.blue(`${index + 1}. ${step}`));
    });
  }
}

// Export singleton instance
export default Logger;
