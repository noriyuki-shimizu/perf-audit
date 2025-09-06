import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import type { HookData, Plugin, PluginConfig, PluginContext, PluginHook } from '../types/plugin.ts';

export class PluginManager extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private pluginStores: Map<string, Map<string, any>> = new Map();
  private config: any;
  private logger = {
    info: (message: string) => console.log(`[Plugin] ${message}`),
    warn: (message: string) => console.warn(`[Plugin] ${message}`),
    error: (message: string) => console.error(`[Plugin] ${message}`),
  };

  constructor(config: any) {
    super();
    this.config = config;
  }

  // Load plugins from configuration
  async loadPlugins(): Promise<void> {
    const pluginConfigs = this.config.plugins || [];

    for (const pluginConfig of pluginConfigs) {
      if (pluginConfig.enabled) {
        try {
          await this.loadPlugin(pluginConfig);
        } catch (error) {
          this.logger.error(`Failed to load plugin ${pluginConfig.name}: ${error}`);
        }
      }
    }
  }

  // Load a single plugin
  async loadPlugin(pluginConfig: PluginConfig): Promise<void> {
    const { name, options = {} } = pluginConfig;

    let plugin: Plugin;

    // Try to load built-in plugin first
    try {
      const builtinPath = path.join(__dirname, '../plugins', `${name}.js`);
      if (fs.existsSync(builtinPath)) {
        const pluginModule = await import(builtinPath);
        plugin = pluginModule.default || pluginModule;
      } else {
        // Try to load from node_modules
        const pluginModule = await import(name);
        plugin = pluginModule.default || pluginModule;
      }
    } catch (error) {
      throw new Error(`Could not load plugin ${name}: ${error}`);
    }

    // Create plugin context
    const store = new Map<string, any>();
    this.pluginStores.set(name, store);

    const context: PluginContext = {
      config: { ...this.config, pluginOptions: options },
      logger: {
        info: (message: string) => this.logger.info(`[${name}] ${message}`),
        warn: (message: string) => this.logger.warn(`[${name}] ${message}`),
        error: (message: string) => this.logger.error(`[${name}] ${message}`),
      },
      emit: (event: string, ...args: any[]) => this.emit(event, ...args),
      store,
    };

    // Install plugin
    if (plugin.install) {
      await plugin.install(context);
    }

    this.plugins.set(name, plugin);
    this.logger.info(`Loaded plugin: ${name} v${plugin.version || '1.0.0'}`);
  }

  // Execute hook for all loaded plugins
  async executeHook<K extends PluginHook>(
    hook: K,
    data: HookData[K],
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [name, plugin] of this.plugins) {
      if (plugin.hooks[hook]) {
        const store = this.pluginStores.get(name)!;
        const context: PluginContext = {
          config: this.config,
          logger: {
            info: (message: string) => this.logger.info(`[${name}] ${message}`),
            warn: (message: string) => this.logger.warn(`[${name}] ${message}`),
            error: (message: string) => this.logger.error(`[${name}] ${message}`),
          },
          emit: (event: string, ...args: any[]) => this.emit(event, ...args),
          store,
        };

        try {
          const result = plugin.hooks[hook]!(context, data);
          if (result instanceof Promise) {
            promises.push(result);
          }
        } catch (error) {
          this.logger.error(`Plugin ${name} hook ${hook} failed: ${error}`);
        }
      }
    }

    await Promise.allSettled(promises);
  }

  // Unload all plugins
  async unloadPlugins(): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        const store = this.pluginStores.get(name)!;
        const context: PluginContext = {
          config: this.config,
          logger: {
            info: (message: string) => this.logger.info(`[${name}] ${message}`),
            warn: (message: string) => this.logger.warn(`[${name}] ${message}`),
            error: (message: string) => this.logger.error(`[${name}] ${message}`),
          },
          emit: (event: string, ...args: any[]) => this.emit(event, ...args),
          store,
        };

        if (plugin.uninstall) {
          await plugin.uninstall(context);
        }
      } catch (error) {
        this.logger.error(`Failed to uninstall plugin ${name}: ${error}`);
      }
    }

    this.plugins.clear();
    this.pluginStores.clear();
  }

  // Get list of loaded plugins
  getLoadedPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  // Check if plugin is loaded
  isPluginLoaded(name: string): boolean {
    return this.plugins.has(name);
  }
}
