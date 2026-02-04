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
    REVALIDATE_API_KEY: string;
    CORS_ORIGINS: string[];
    CACHE_MAX_AGE: number;
    HOT_RELOAD_ENABLED: boolean;
    WEBSOCKET_ENABLED: boolean;
    FILE_WATCHING_ENABLED: boolean;
    WEBSOCKET_PATH: string;
    FILE_WATCH_DEBOUNCE: number;
}

/**
 * Type validators for each config key
 * Keys in this object define the whitelist of allowed configuration keys
 */
const CONFIG_VALIDATORS: Record<keyof ServerConfig, (value: unknown) => boolean> = {
    PORT: (v) => typeof v === 'number' && v > 0 && v <= 65535,
    NODE_ENV: (v) => typeof v === 'string' && ['development', 'production', 'test'].includes(v),
    PROJECT_ROOT: (v) => typeof v === 'string' && v.length > 0 && v.length < 1024,
    BUILD_DIR: (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]+$/.test(v) && v.length < 64,
    REQUEST_TIMEOUT: (v) => typeof v === 'number' && v > 0 && v <= 300000,
    BODY_SIZE_LIMIT: (v) => typeof v === 'string' && /^\d+(kb|mb|gb)?$/i.test(v),
    RATE_LIMIT_WINDOW: (v) => typeof v === 'number' && v > 0 && v <= 86400000,
    RATE_LIMIT_MAX: (v) => typeof v === 'number' && v > 0 && v <= 10000,
    REVALIDATE_RATE_LIMIT_MAX: (v) => typeof v === 'number' && v > 0 && v <= 1000,
    REVALIDATE_API_KEY: (v) => typeof v === 'string' && v.length >= 16 && v.length <= 256,
    CORS_ORIGINS: (v) => Array.isArray(v) && v.every((o) => typeof o === 'string' && /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(o)),
    CACHE_MAX_AGE: (v) => typeof v === 'number' && v >= 0 && v <= 31536000,
    HOT_RELOAD_ENABLED: (v) => typeof v === 'boolean',
    WEBSOCKET_ENABLED: (v) => typeof v === 'boolean',
    FILE_WATCHING_ENABLED: (v) => typeof v === 'boolean',
    WEBSOCKET_PATH: (v) => typeof v === 'string' && /^\/[a-zA-Z0-9_-]*$/.test(v),
    FILE_WATCH_DEBOUNCE: (v) => typeof v === 'number' && v >= 0 && v <= 10000,
};

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
    REVALIDATE_API_KEY: process.env.REVALIDATE_API_KEY || '', // API key for revalidate endpoint (required in production)
    CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',').filter(Boolean) || [], // Allowed CORS origins (empty = same-origin only in prod, localhost in dev)
    CACHE_MAX_AGE: process.env.NODE_ENV === 'production' ? 86400 : 0, // 1 day in prod, no cache in dev

    // Hot reload configuration
    HOT_RELOAD_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_ENABLED: process.env.NODE_ENV === 'development',
    FILE_WATCHING_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_PATH: '/ws',
    FILE_WATCH_DEBOUNCE: 300, // milliseconds
};

/**
 * Validate and sanitize user configuration
 * Only allows whitelisted keys with valid types
 */
const validateUserConfig = (rawConfig: unknown): Partial<ServerConfig> => {
    if (typeof rawConfig !== 'object' || rawConfig === null) {
        console.warn('[Config] Invalid config format: expected object');
        return {};
    }

    const validatedConfig: Partial<ServerConfig> = {};
    const configObj = rawConfig as Record<string, unknown>;

    for (const [key, value] of Object.entries(configObj)) {
        // Check if key is allowed (exists in validators)
        if (!(key in CONFIG_VALIDATORS)) {
            console.warn(`[Config] Ignoring unknown config key: ${key}`);
            continue;
        }

        const typedKey = key as keyof ServerConfig;
        const validator = CONFIG_VALIDATORS[typedKey];

        // Validate value type
        if (!validator(value)) {
            console.warn(`[Config] Invalid value for ${key}: ${JSON.stringify(value)}`);
            continue;
        }

        // Type assertion is safe here because we validated the value
        (validatedConfig as Record<string, unknown>)[key] = value;
    }

    return validatedConfig;
};

/**
 * Load user configuration from static.config.ts in the project root
 * Validates all loaded values against a strict schema
 */
const loadUserConfig = async (): Promise<Partial<ServerConfig>> => {
    const projectRoot = path.resolve(process.cwd());
    const configPath = path.join(projectRoot, 'static.config.ts');

    if (!fs.existsSync(configPath)) {
        return {};
    }

    try {
        const imported = await import(configPath);
        const rawConfig = imported.default || imported.CONFIG || {};

        // Validate and sanitize the loaded configuration
        const validatedConfig = validateUserConfig(rawConfig);

        if (Object.keys(validatedConfig).length > 0) {
            console.log('[Config] Loaded user configuration from static.config.ts');
        }

        return validatedConfig;
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
