import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../../../src/utils/logger.ts';

vi.setConfig({ testTimeout: 100 });

vi.mock('chalk', () => {
  const createColorMock = (color: string) =>
    Object.assign(
      vi.fn((text: string) => `[${color.toUpperCase()}]${text}[/${color.toUpperCase()}]`),
      {
        bold: vi.fn((text: string) => `[BOLD_${color.toUpperCase()}]${text}[/BOLD_${color.toUpperCase()}]`),
      },
    );

  return {
    default: {
      red: createColorMock('red'),
      yellow: createColorMock('yellow'),
      blue: createColorMock('blue'),
      green: createColorMock('green'),
      gray: createColorMock('gray'),
      white: createColorMock('white'),
      dim: createColorMock('dim'),
      bold: Object.assign(
        vi.fn((text: string) => `**${text}**`),
        {
          blue: vi.fn((text: string) => `[BOLD_BLUE]${text}[/BOLD_BLUE]`),
          green: vi.fn((text: string) => `[BOLD_GREEN]${text}[/BOLD_GREEN]`),
          red: vi.fn((text: string) => `[BOLD_RED]${text}[/BOLD_RED]`),
        },
      ),
    },
  };
});

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic logging methods', () => {
    it('should log info message with blue icon', () => {
      Logger.info('Test info message');

      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]ℹ️[/BLUE] Test info message');
    });

    it('should log success message with green icon', () => {
      Logger.success('Test success message');

      expect(consoleSpy).toHaveBeenCalledWith('[GREEN]✅[/GREEN] Test success message');
    });

    it('should log warning message with yellow icon', () => {
      Logger.warn('Test warning message');

      expect(consoleSpy).toHaveBeenCalledWith('[YELLOW]⚠️[/YELLOW] Test warning message');
    });

    it('should log error message with red icon', () => {
      Logger.error('Test error message');

      expect(consoleSpy).toHaveBeenCalledWith('[RED]❌[/RED] Test error message');
    });

    it('should log debug message with gray icon', () => {
      Logger.debug('Test debug message');

      expect(consoleSpy).toHaveBeenCalledWith('[GRAY]🔍[/GRAY] [GRAY]Test debug message[/GRAY]');
    });

    it.each([
      { method: 'info', meta: { key: 'value' } },
      { method: 'success', meta: { count: 5 } },
      { method: 'warn', meta: { warning: true } },
      { method: 'error', meta: { code: 404 } },
    ])('should log $method message with meta data', ({ method, meta }) => {
      Logger[method]('Test message', meta);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[DIM]{"'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(JSON.stringify(meta)));
    });

    it('should not include meta when meta is empty object', () => {
      Logger.info('Test message', {});

      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]ℹ️[/BLUE] Test message');
    });
  });

  describe('special formatting methods', () => {
    it('should format title with underline', () => {
      Logger.title('Test Title');

      expect(consoleSpy).toHaveBeenCalledWith('[BOLD_BLUE]\nTest Title[/BOLD_BLUE]');
      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]══════════[/BLUE]');
    });

    it('should format section with bold text and icon', () => {
      Logger.section('Test Section');

      expect(consoleSpy).toHaveBeenCalledWith('**\n📋 Test Section**');
    });

    it('should display table data', () => {
      const tableData = [{ name: 'test', size: '100KB' }];
      const consoleSpy = vi.spyOn(console, 'table').mockImplementation(() => {});

      Logger.table(tableData);

      expect(consoleSpy).toHaveBeenCalledWith(tableData);

      consoleSpy.mockRestore();
    });

    it('should display JSON data with pretty formatting', () => {
      const jsonData = { name: 'test', value: 123 };

      Logger.json(jsonData);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(jsonData, null, 2));
    });

    it('should display raw message without formatting', () => {
      Logger.raw('Raw message');

      expect(consoleSpy).toHaveBeenCalledWith('Raw message');
    });
  });

  describe('progress method', () => {
    it('should display progress with step and total', () => {
      Logger.progress('Processing files', 3, 10);

      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]ℹ️[/BLUE] Processing files [3/10] (30%)');
    });

    it('should display progress without step and total', () => {
      Logger.progress('Loading...');

      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]ℹ️[/BLUE] 🔄 Loading...');
    });

    it('should handle zero total gracefully', () => {
      Logger.progress('Processing', 0, 0);

      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]ℹ️[/BLUE] Processing [0/0] (NaN%)');
    });
  });

  describe('prompt method', () => {
    it('should return formatted prompt string', () => {
      const result = Logger.prompt('Continue?');

      expect(result).toBe('[YELLOW]❓ Continue?[/YELLOW]');
    });
  });

  describe('result method', () => {
    it('should display results with default status', () => {
      const items = [
        { label: 'File Size', value: '100KB' },
        { label: 'Bundle Count', value: '5' },
      ];

      Logger.result('Analysis Results', items);

      expect(consoleSpy).toHaveBeenCalledWith('**\n📊 Analysis Results**');
      expect(consoleSpy).toHaveBeenCalledWith('• File Size: [WHITE]100KB[/WHITE]');
      expect(consoleSpy).toHaveBeenCalledWith('• Bundle Count: [WHITE]5[/WHITE]');
    });

    it.each(
      [
        { status: 'success', expectedIcon: '✅', expectedColor: 'GREEN' },
        { status: 'warning', expectedIcon: '⚠️', expectedColor: 'YELLOW' },
        { status: 'error', expectedIcon: '❌', expectedColor: 'RED' },
      ] as const,
    )('should display result with $status status', ({ status, expectedIcon, expectedColor }) => {
      const items = [{ label: 'Test', value: 'Value', status }];

      Logger.result('Results', items);

      expect(consoleSpy).toHaveBeenCalledWith(`${expectedIcon} Test: [${expectedColor}]Value[/${expectedColor}]`);
    });
  });

  describe('complete method', () => {
    it('should display completion message', () => {
      Logger.complete('Analysis finished');

      expect(consoleSpy).toHaveBeenCalledWith('[BOLD_GREEN]\n🎉 Analysis finished[/BOLD_GREEN]');
    });

    it('should display completion message with details', () => {
      Logger.complete('Analysis finished', ['5 files processed', '2 warnings found']);

      expect(consoleSpy).toHaveBeenCalledWith('[BOLD_GREEN]\n🎉 Analysis finished[/BOLD_GREEN]');
      expect(consoleSpy).toHaveBeenCalledWith('[GREEN]   5 files processed[/GREEN]');
      expect(consoleSpy).toHaveBeenCalledWith('[GREEN]   2 warnings found[/GREEN]');
    });
  });

  describe('failure method', () => {
    it('should display failure message', () => {
      Logger.failure('Analysis failed');

      expect(consoleSpy).toHaveBeenCalledWith('[BOLD_RED]\n💥 Analysis failed[/BOLD_RED]');
    });

    it('should display failure message with details', () => {
      Logger.failure('Analysis failed', ['Config file not found', 'Build directory missing']);

      expect(consoleSpy).toHaveBeenCalledWith('[BOLD_RED]\n💥 Analysis failed[/BOLD_RED]');
      expect(consoleSpy).toHaveBeenCalledWith('[RED]   Config file not found[/RED]');
      expect(consoleSpy).toHaveBeenCalledWith('[RED]   Build directory missing[/RED]');
    });
  });

  describe('nextSteps method', () => {
    it('should display next steps with numbered list', () => {
      const steps = ['Run build command', 'Check output directory', 'Review results'];

      Logger.nextSteps('Next Steps', steps);

      expect(consoleSpy).toHaveBeenCalledWith('[BOLD_BLUE]\n💡 Next Steps[/BOLD_BLUE]');
      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]1. Run build command[/BLUE]');
      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]2. Check output directory[/BLUE]');
      expect(consoleSpy).toHaveBeenCalledWith('[BLUE]3. Review results[/BLUE]');
    });

    it('should handle empty steps array', () => {
      Logger.nextSteps('No Steps', []);

      expect(consoleSpy).toHaveBeenCalledWith('[BOLD_BLUE]\n💡 No Steps[/BOLD_BLUE]');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });
  });
});
