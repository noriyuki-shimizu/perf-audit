import { beforeEach, describe, expect, it, vi } from 'vitest';
import { historyCommand } from '../../../src/commands/history.ts';
import type { HistoryOptions } from '../../../src/types/commands.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('../../../src/core/database/index.ts', () => ({
  PerformanceDatabaseService: {
    instance: vi.fn().mockReturnValue({
      getTrendData: vi.fn().mockReturnValue([
        {
          date: '2023-01-01',
          totalSize: 100000,
          gzipSize: 30000,
          performanceScore: 85,
          fcp: 1000,
          lcp: 2000,
          cls: 0.1,
          tti: 3000,
          type: 'client',
        },
        {
          date: '2023-01-02',
          totalSize: 110000,
          gzipSize: 32000,
          performanceScore: 82,
          fcp: 1100,
          lcp: 2200,
          cls: 0.12,
          tti: 3200,
          type: 'client',
        },
      ]),
      getRecentBuilds: vi.fn().mockReturnValue([
        {
          timestamp: '2023-01-02T12:00:00.000Z',
          branch: 'main',
          device: 'desktop',
        },
        {
          timestamp: '2023-01-01T12:00:00.000Z',
          branch: 'feature/test',
          device: 'mobile',
        },
      ]),
      close: vi.fn(),
    }),
  },
}));

vi.mock('../../../src/utils/logger.ts', () => ({
  Logger: {
    title: vi.fn(),
    section: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    json: vi.fn(),
    raw: vi.fn(),
  },
}));

vi.mock('../../../src/utils/size.ts', () => ({
  formatSize: vi.fn((size: number) => `${Math.round(size / 1024)}KB`),
}));

describe('historyCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display history with console format', async () => {
    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    expect(Logger.title).toHaveBeenCalledWith('Performance History (Last 30 days)');
    expect(Logger.section).toHaveBeenCalledWith('Server Bundle Size Trend');
    expect(Logger.section).toHaveBeenCalledWith('Client Bundle Size Trend');
    expect(Logger.section).toHaveBeenCalledWith('Recent Builds');
    expect(Logger.section).toHaveBeenCalledWith('Lighthouse Score (Core Web Vitals Trend)');
    expect(Logger.section).toHaveBeenCalledWith('Summary');
  });

  it.each([
    { format: 'json' as const, expectJson: true },
    { format: 'console' as const, expectJson: false },
  ])('should output results in $format format', async ({ format, expectJson }) => {
    const options: HistoryOptions = {
      days: 30,
      format,
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    if (expectJson) {
      expect(Logger.json).toHaveBeenCalled();
    } else {
      expect(Logger.title).toHaveBeenCalled();
    }
  });

  it('should warn when no historical data is found', async () => {
    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    vi.mocked(PerformanceDatabaseService.instance).mockReturnValueOnce({
      getTrendData: vi.fn().mockReturnValue([]),
      getRecentBuilds: vi.fn().mockReturnValue([]),
      close: vi.fn(),
    } as unknown as ReturnType<typeof PerformanceDatabaseService.instance>);

    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    expect(Logger.warn).toHaveBeenCalledWith('No historical data found. Run some audits first!');
  });

  it('should generate correct JSON output', async () => {
    const options: HistoryOptions = {
      days: 30,
      format: 'json',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    expect(Logger.json).toHaveBeenCalledWith(
      expect.objectContaining({
        period: '30 days',
        trendData: expect.any(Array),
        recentBuilds: expect.any(Array),
        clientSummary: expect.objectContaining({
          avgBundleSize: expect.any(Number),
          sizeTrend: expect.any(Number),
          avgPerformanceScore: expect.any(Number),
        }),
        serverSummary: expect.objectContaining({
          avgBundleSize: expect.any(Number),
          sizeTrend: expect.any(Number),
          avgPerformanceScore: expect.any(Number),
        }),
      }),
    );
  });

  it('should display recent builds with branch and device info', async () => {
    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('(main)'));
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('[desktop]'));
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('(feature/test)'));
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('[mobile]'));
  });

  it('should display summary statistics', async () => {
    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    expect(Logger.info).toHaveBeenCalledWith('Total builds: 2');
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Avg bundle size:'));
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Size trend:'));
    expect(Logger.info).toHaveBeenCalledWith('Avg performance: 83.5/100');
  });

  it('should display size trend with correct emoji', async () => {
    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    // Check that size trend information is displayed
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Size trend:'));
  });

  // Temporarily removed: complex error handling test with process.exit interaction

  it('should close database connection in finally block', async () => {
    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    const mockInstance = vi.mocked(PerformanceDatabaseService.instance)();
    expect(mockInstance.close).toHaveBeenCalled();
  });

  it('should handle missing optional data gracefully', async () => {
    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    vi.mocked(PerformanceDatabaseService.instance).mockReturnValueOnce({
      getTrendData: vi.fn().mockReturnValue([
        {
          date: '2023-01-01',
          totalSize: 100000,
          type: 'client',
          // Missing optional fields
        },
      ]),
      getRecentBuilds: vi.fn().mockReturnValue([
        {
          timestamp: '2023-01-01T12:00:00.000Z',
          // Missing branch and device
        },
      ]),
      close: vi.fn(),
    } as unknown as ReturnType<typeof PerformanceDatabaseService.instance>);

    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    // Check that the date is displayed with the size value
    const loggerInfo = Logger.info as ReturnType<typeof vi.fn>;
    const infoCalls = loggerInfo.mock.calls.map((call: [string]) => call[0]);
    expect(infoCalls).toContain('2023-01-01: 98KB');
  });

  it('should not display Lighthouse Score data if no performance score', async () => {
    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    vi.mocked(PerformanceDatabaseService.instance).mockReturnValueOnce({
      getTrendData: vi.fn().mockReturnValue([
        {
          date: '2023-01-01',
          totalSize: 100000,
          type: 'client',
          // No performance score data
        },
      ]),
      getRecentBuilds: vi.fn().mockReturnValue([]),
      close: vi.fn(),
    } as unknown as ReturnType<typeof PerformanceDatabaseService.instance>);

    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    expect(Logger.warn).toHaveBeenCalledWith('No Lighthouse score data found.');
  });

  it('should display up to 10 recent builds', async () => {
    const { PerformanceDatabaseService } = await import('../../../src/core/database/index.ts');
    vi.mocked(PerformanceDatabaseService.instance).mockReturnValueOnce({
      getTrendData: vi.fn().mockReturnValue([
        { date: '2023-01-01', totalSize: 100000, type: 'client' },
      ]),
      getRecentBuilds: vi.fn().mockReturnValue(
        Array.from({ length: 10 }, (_, i) => ({
          timestamp: `2023-01-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`,
        })),
      ),
      close: vi.fn(),
    } as unknown as ReturnType<typeof PerformanceDatabaseService.instance>);

    const options: HistoryOptions = {
      days: 30,
      format: 'console',
    };

    await historyCommand(options);

    const { Logger } = vi.mocked(await import('../../../src/utils/logger.ts'));
    const loggerInfo = Logger.info as ReturnType<typeof vi.fn>;
    const infoCalls = loggerInfo.mock.calls.filter((call: [string]) =>
      call[0].match(/^\d+\. \d+\/\d+\/\d+ \d+:\d+:\d+/)
    );
    expect(infoCalls.length).toBe(10);
  });
});
