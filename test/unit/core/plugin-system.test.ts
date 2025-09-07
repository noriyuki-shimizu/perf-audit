import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginManager } from '../../../src/core/plugin-system.ts';

// Set test timeout
vi.setConfig({ testTimeout: 100 });

// Mock modules
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    vi.clearAllMocks();
    const config = {
      plugins: [
        {
          name: 'test-plugin',
          enabled: true,
          options: { setting: 'value' },
        },
        {
          name: 'disabled-plugin',
          enabled: false,
        },
      ],
    };
    pluginManager = new PluginManager(config);
  });

  it('should initialize with config', () => {
    expect(pluginManager).toBeInstanceOf(PluginManager);
  });
});
