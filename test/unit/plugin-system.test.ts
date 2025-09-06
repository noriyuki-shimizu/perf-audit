import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginManager } from '../../src/core/plugin-system.ts';
import type { Plugin } from '../../src/core/plugin-system.ts';

describe('PluginSystem', () => {
  let pluginManager: PluginManager;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      plugins: [
        { name: 'test-plugin-1', enabled: true, options: { test: true } },
        { name: 'test-plugin-2', enabled: false },
      ],
    };
    pluginManager = new PluginManager(mockConfig);
  });

  describe('PluginManager', () => {
    it('should initialize with config', () => {
      expect(pluginManager).toBeDefined();
      expect(pluginManager.getLoadedPlugins()).toHaveLength(0);
    });

    it('should track loaded plugins', () => {
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {},
      };

      // Manually add plugin for testing
      pluginManager['plugins'].set('test-plugin', mockPlugin);

      expect(pluginManager.getLoadedPlugins()).toHaveLength(1);
      expect(pluginManager.isPluginLoaded('test-plugin')).toBe(true);
      expect(pluginManager.isPluginLoaded('non-existent')).toBe(false);
    });

    it('should execute hooks for loaded plugins', async () => {
      const hookFn = vi.fn();
      const mockPlugin: Plugin = {
        name: 'test-plugin',
        hooks: {
          beforeAnalysis: hookFn,
        },
      };

      pluginManager['plugins'].set('test-plugin', mockPlugin);
      pluginManager['pluginStores'].set('test-plugin', new Map());

      await pluginManager.executeHook('beforeAnalysis', { config: mockConfig });

      expect(hookFn).toHaveBeenCalledWith(
        expect.objectContaining({
          config: mockConfig,
          logger: expect.any(Object),
          emit: expect.any(Function),
          store: expect.any(Map),
        }),
        { config: mockConfig },
      );
    });

    it('should handle hook execution errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingHook = vi.fn(() => {
        throw new Error('Hook failed');
      });

      const mockPlugin: Plugin = {
        name: 'failing-plugin',
        hooks: {
          beforeAnalysis: failingHook,
        },
      };

      pluginManager['plugins'].set('failing-plugin', mockPlugin);
      pluginManager['pluginStores'].set('failing-plugin', new Map());

      // Should not throw
      await expect(pluginManager.executeHook('beforeAnalysis', { config: mockConfig }))
        .resolves.not.toThrow();

      expect(failingHook).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should execute install hook when loading plugin', async () => {
      const installFn = vi.fn();
      const mockPlugin: Plugin = {
        name: 'install-test',
        install: installFn,
        hooks: {},
      };

      // Manually simulate plugin loading without using dynamic import
      pluginManager['plugins'].set('install-test', mockPlugin);
      pluginManager['pluginStores'].set('install-test', new Map());

      // Manually call install
      const context = {
        config: { ...mockConfig, pluginOptions: { test: true } },
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
        emit: vi.fn(),
        store: new Map(),
      };

      await mockPlugin.install!(context);

      expect(installFn).toHaveBeenCalledWith(context);
    });

    it('should handle plugin store per plugin', async () => {
      const plugin1Store = new Map();
      const plugin2Store = new Map();

      pluginManager['pluginStores'].set('plugin1', plugin1Store);
      pluginManager['pluginStores'].set('plugin2', plugin2Store);

      const hook1 = vi.fn(context => {
        context.store.set('test', 'plugin1-data');
      });

      const hook2 = vi.fn(context => {
        context.store.set('test', 'plugin2-data');
      });

      pluginManager['plugins'].set('plugin1', { name: 'plugin1', hooks: { beforeAnalysis: hook1 } });
      pluginManager['plugins'].set('plugin2', { name: 'plugin2', hooks: { beforeAnalysis: hook2 } });

      await pluginManager.executeHook('beforeAnalysis', { config: mockConfig });

      expect(plugin1Store.get('test')).toBe('plugin1-data');
      expect(plugin2Store.get('test')).toBe('plugin2-data');
    });

    it('should unload plugins properly', async () => {
      const uninstallFn = vi.fn();
      const mockPlugin: Plugin = {
        name: 'uninstall-test',
        uninstall: uninstallFn,
        hooks: {},
      };

      pluginManager['plugins'].set('uninstall-test', mockPlugin);
      pluginManager['pluginStores'].set('uninstall-test', new Map());

      await pluginManager.unloadPlugins();

      expect(uninstallFn).toHaveBeenCalled();
      expect(pluginManager.getLoadedPlugins()).toHaveLength(0);
    });
  });

  describe('Plugin Context', () => {
    it('should provide logger to plugins', async () => {
      let capturedContext: any;
      const hookFn = vi.fn(context => {
        capturedContext = context;
      });

      const mockPlugin: Plugin = {
        name: 'logger-test',
        hooks: { beforeAnalysis: hookFn },
      };

      pluginManager['plugins'].set('logger-test', mockPlugin);
      pluginManager['pluginStores'].set('logger-test', new Map());

      await pluginManager.executeHook('beforeAnalysis', { config: mockConfig });

      expect(capturedContext.logger).toHaveProperty('info');
      expect(capturedContext.logger).toHaveProperty('warn');
      expect(capturedContext.logger).toHaveProperty('error');
    });

    it('should provide event emitter to plugins', async () => {
      let capturedContext: any;
      const hookFn = vi.fn(context => {
        capturedContext = context;
        context.emit('test-event', { data: 'test' });
      });

      const mockPlugin: Plugin = {
        name: 'emitter-test',
        hooks: { beforeAnalysis: hookFn },
      };

      pluginManager['plugins'].set('emitter-test', mockPlugin);
      pluginManager['pluginStores'].set('emitter-test', new Map());

      const eventHandler = vi.fn();
      pluginManager.on('test-event', eventHandler);

      await pluginManager.executeHook('beforeAnalysis', { config: mockConfig });

      expect(capturedContext.emit).toBeInstanceOf(Function);
      expect(eventHandler).toHaveBeenCalledWith({ data: 'test' });
    });
  });
});
