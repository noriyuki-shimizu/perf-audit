import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { AuditResult, BundleInfo, PerformanceMetrics } from '../types/config.js';

// Plugin lifecycle hooks
export type PluginHook =
  | 'beforeAnalysis'
  | 'afterAnalysis'
  | 'beforeBundleAnalysis'
  | 'afterBundleAnalysis'
  | 'beforeLighthouse'
  | 'afterLighthouse'
  | 'beforeReport'
  | 'afterReport'
  | 'onError'
  | 'onNotification';

// Plugin context passed to each hook
export interface PluginContext {
  config: any;
  logger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  emit: (event: string, ...args: any[]) => void;
  store: Map<string, any>; // Plugin-specific data store
}

// Data passed to different hooks
export interface HookData {
  beforeAnalysis?: { config: any; };
  afterAnalysis?: { result: AuditResult; };
  beforeBundleAnalysis?: { outputPath: string; };
  afterBundleAnalysis?: { bundles: BundleInfo[]; };
  beforeLighthouse?: { url: string; options: any; };
  afterLighthouse?: { metrics: PerformanceMetrics; };
  beforeReport?: { result: AuditResult; format: string; };
  afterReport?: { result: AuditResult; outputPath: string; };
  onError?: { error: Error; context: string; };
  onNotification?: { type: string; data: any; };
}

// Plugin interface
export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  hooks: {
    [K in PluginHook]?: (context: PluginContext, data: HookData[K]) => Promise<void> | void;
  };
  install?: (context: PluginContext) => Promise<void> | void;
  uninstall?: (context: PluginContext) => Promise<void> | void;
}

// Plugin configuration
export interface PluginConfig {
  name: string;
  enabled: boolean;
  options?: Record<string, any>;
}

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
