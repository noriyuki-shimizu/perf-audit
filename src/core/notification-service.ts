import { AuditResult } from '../types/config.ts';
import { formatSize } from '../utils/size.ts';

export interface PerformanceAlert {
  type: 'regression' | 'improvement' | 'budget_exceeded';
  changes?: Array<{
    name: string;
    delta: number;
    percentage: number;
    isRegression: boolean;
  }>;
  result: AuditResult;
  message?: string;
}

export interface NotificationConfig {
  slack?: {
    webhook?: string;
    channel?: string;
    username?: string;
  };
  discord?: {
    webhook?: string;
  };
  email?: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    from: string;
    to: string[];
  };
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(private appConfig: any) {
    this.config = appConfig.notifications || {};
  }

  async sendPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      // Send to Slack if configured
      if (this.config.slack?.webhook) {
        promises.push(this.sendSlackNotification(alert));
      }

      // Send to Discord if configured
      if (this.config.discord?.webhook) {
        promises.push(this.sendDiscordNotification(alert));
      }

      // Send email if configured
      if (this.config.email) {
        promises.push(this.sendEmailNotification(alert));
      }

      await Promise.allSettled(promises);
    } catch (error) {
      console.warn('Failed to send notifications:', error);
    }
  }

  private async sendSlackNotification(alert: PerformanceAlert): Promise<void> {
    const { slack } = this.config;
    if (!slack?.webhook) return;

    const payload = this.formatSlackMessage(alert);

    try {
      const response = await fetch(slack.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: slack.channel || '#performance',
          username: slack.username || 'perf-audit-bot',
          ...payload,
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to send Slack notification:', error);
    }
  }

  private async sendDiscordNotification(alert: PerformanceAlert): Promise<void> {
    const { discord } = this.config;
    if (!discord?.webhook) return;

    const embed = this.formatDiscordEmbed(alert);

    try {
      const response = await fetch(discord.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to send Discord notification:', error);
    }
  }

  private async sendEmailNotification(alert: PerformanceAlert): Promise<void> {
    // Email functionality would require additional dependencies like nodemailer
    // For now, we'll just log that email would be sent
    console.log('Email notification would be sent:', this.formatEmailContent(alert));
  }

  private formatSlackMessage(alert: PerformanceAlert) {
    const { type, changes, result } = alert;

    const icon = {
      regression: ':warning:',
      improvement: ':white_check_mark:',
      budget_exceeded: ':rotating_light:',
    }[type];

    const title = {
      regression: 'Performance Regression Detected',
      improvement: 'Performance Improvement',
      budget_exceeded: 'Budget Exceeded',
    }[type];

    let text = `${icon} *${title}*\n\n`;

    if (changes && changes.length > 0) {
      text += '*Changes:*\n';
      changes.forEach(change => {
        const emoji = change.isRegression ? ':chart_with_upwards_trend:' : ':chart_with_downwards_trend:';
        const delta = change.delta > 0 ? `+${formatSize(change.delta)}` : formatSize(change.delta);
        const percent = change.percentage > 0
          ? `+${change.percentage.toFixed(1)}%`
          : `${change.percentage.toFixed(1)}%`;
        text += `${emoji} \`${change.name}\`: ${delta} (${percent})\n`;
      });
    }

    // Add budget status
    if (result.budgetStatus !== 'ok') {
      text += `\n*Budget Status:* ${result.budgetStatus.toUpperCase()}`;
    }

    text += `\n*Timestamp:* ${new Date(result.timestamp).toLocaleString()}`;

    return {
      text,
      attachments: [
        {
          color: type === 'regression' ? 'danger' : 'good',
          fields: [
            {
              title: 'Total Bundles',
              value: result.bundles.length.toString(),
              short: true,
            },
            {
              title: 'Total Size',
              value: formatSize(result.bundles.reduce((sum, b) => sum + b.size, 0)),
              short: true,
            },
          ],
        },
      ],
    };
  }

  private formatDiscordEmbed(alert: PerformanceAlert) {
    const { type, changes, result } = alert;

    const colors = {
      regression: 0xff6b6b, // Red
      improvement: 0x51cf66, // Green
      budget_exceeded: 0xffd43b, // Yellow
    };

    const title = {
      regression: '⚠️ Performance Regression Detected',
      improvement: '✅ Performance Improvement',
      budget_exceeded: '🚨 Budget Exceeded',
    }[type];

    const fields: Array<{ name: string; value: string; inline?: boolean; }> = [];

    if (changes && changes.length > 0) {
      const changesText = changes.map(change => {
        const emoji = change.isRegression ? '📈' : '📉';
        const delta = change.delta > 0 ? `+${formatSize(change.delta)}` : formatSize(change.delta);
        const percent = change.percentage > 0
          ? `+${change.percentage.toFixed(1)}%`
          : `${change.percentage.toFixed(1)}%`;
        return `${emoji} \`${change.name}\`: ${delta} (${percent})`;
      }).join('\n');

      fields.push({
        name: 'Changes',
        value: changesText,
      });
    }

    fields.push(
      {
        name: 'Total Bundles',
        value: result.bundles.length.toString(),
        inline: true,
      },
      {
        name: 'Total Size',
        value: formatSize(result.bundles.reduce((sum, b) => sum + b.size, 0)),
        inline: true,
      },
      {
        name: 'Budget Status',
        value: result.budgetStatus.toUpperCase(),
        inline: true,
      },
    );

    return {
      title,
      color: colors[type],
      fields,
      timestamp: result.timestamp,
      footer: {
        text: 'perf-audit-cli',
      },
    };
  }

  private formatEmailContent(alert: PerformanceAlert): string {
    const { type, changes, result } = alert;

    const title = {
      regression: 'Performance Regression Detected',
      improvement: 'Performance Improvement',
      budget_exceeded: 'Budget Exceeded',
    }[type];

    let content = `Subject: ${title}\n\n`;
    content += `${title}\n`;
    content += '='.repeat(title.length) + '\n\n';

    if (changes && changes.length > 0) {
      content += 'Changes:\n';
      changes.forEach(change => {
        const delta = change.delta > 0 ? `+${formatSize(change.delta)}` : formatSize(change.delta);
        const percent = change.percentage > 0
          ? `+${change.percentage.toFixed(1)}%`
          : `${change.percentage.toFixed(1)}%`;
        content += `- ${change.name}: ${delta} (${percent})\n`;
      });
      content += '\n';
    }

    content += `Total Bundles: ${result.bundles.length}\n`;
    content += `Total Size: ${formatSize(result.bundles.reduce((sum, b) => sum + b.size, 0))}\n`;
    content += `Budget Status: ${result.budgetStatus.toUpperCase()}\n`;
    content += `Timestamp: ${new Date(result.timestamp).toLocaleString()}\n`;

    return content;
  }
}
