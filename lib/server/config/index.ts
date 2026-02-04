/**
 * Server configuration constants
 * Centralized configuration for the StaticJS React template server
 */
import * as path from "node:path";
import * as fs from "node:fs";

export interface ServerConfig {
    PORT: number;
    NODE_ENV: string;
    PROJECT_ROOT: string;
    BUILD_DIR: string;
    REQUEST_TIMEOUT: number;
    BODY_SIZE_LIMIT: string;
    RATE_LIMIT_WINDOW: number;
    RATE_LIMIT_MAX: number;
    REVALIDATE_RATE_LIMIT_MAX: number;
    CACHE_MAX_AGE: number;
    HOT_RELOAD_ENABLED: boolean;
    WEBSOCKET_ENABLED: boolean;
    FILE_WATCHING_ENABLED: boolean;
    WEBSOCKET_PATH: string;
    FILE_WATCH_DEBOUNCE: number;
}

export const DEFAULT_CONFIG: ServerConfig = {
    PORT: Number(process.env.PORT) || 3456,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PROJECT_ROOT: path.resolve(process.cwd()),
    BUILD_DIR: '_build',
    REQUEST_TIMEOUT: 30000, // 30 seconds
    BODY_SIZE_LIMIT: '10mb',
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100, // requests per window
    REVALIDATE_RATE_LIMIT_MAX: 10, // stricter limit for revalidate endpoint
    CACHE_MAX_AGE: process.env.NODE_ENV === 'production' ? 86400 : 0, // 1 day in prod, no cache in dev

    // Hot reload configuration
    HOT_RELOAD_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_ENABLED: process.env.NODE_ENV === 'development',
    FILE_WATCHING_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_PATH: '/ws',
    FILE_WATCH_DEBOUNCE: 300, // milliseconds
};

/**
 * Load user configuration from static.config.ts in the project root
 */
const loadUserConfig = async (): Promise<Partial<ServerConfig>> => {
    const projectRoot = path.resolve(process.cwd());
    const configPath = path.join(projectRoot, 'static.config.ts');

    if (!fs.existsSync(configPath)) {
        return {};
    }

    try {
        const imported = await import(configPath);
        const userConfig = imported.default || imported.CONFIG || {};
        console.log('[Config] Loaded user configuration from static.config.ts');
        return userConfig;
    } catch (error) {
        console.warn(`[Config] Failed to load static.config.ts: ${(error as Error).message}`);
        return {};
    }
};

/**
 * Merge default config with user config
 */
const mergeConfigs = (defaults: ServerConfig, userConfig: Partial<ServerConfig>): ServerConfig => {
    const merged = {
        ...defaults,
        ...userConfig,
    };

    // Recalculate derived values based on merged NODE_ENV if not explicitly set
    const nodeEnv = merged.NODE_ENV;
    if (userConfig.CACHE_MAX_AGE === undefined) {
        merged.CACHE_MAX_AGE = nodeEnv === 'production' ? 86400 : 0;
    }
    if (userConfig.HOT_RELOAD_ENABLED === undefined) {
        merged.HOT_RELOAD_ENABLED = nodeEnv === 'development';
    }
    if (userConfig.WEBSOCKET_ENABLED === undefined) {
        merged.WEBSOCKET_ENABLED = nodeEnv === 'development';
    }
    if (userConfig.FILE_WATCHING_ENABLED === undefined) {
        merged.FILE_WATCHING_ENABLED = nodeEnv === 'development';
    }

    return merged;
};

// Load user config and merge with defaults using top-level await
const userConfig = await loadUserConfig();
export const CONFIG: ServerConfig = mergeConfigs(DEFAULT_CONFIG, userConfig);

export const isDevelopment: boolean = CONFIG.NODE_ENV === 'development';
export const isProduction: boolean = CONFIG.NODE_ENV === 'production';
