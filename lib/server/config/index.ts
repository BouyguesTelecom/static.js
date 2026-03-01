/**
 * Server configuration constants
 * Centralized configuration for the StaticJS React template server
 */
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { loadEnv } from "vite";

// Load environment variables from .env files into process.env
// This ensures server-side code (like getStaticProps) can access env vars
const projectRoot = path.resolve(process.cwd());
const mode = process.env.NODE_ENV || 'development';
const env = loadEnv(mode, projectRoot, '');

// Merge loaded env vars into process.env (without overwriting existing vars)
for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
        process.env[key] = value;
    }
}

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
    REVALIDATE_REQUEST_TIMEOUT: number;
    CORS_ORIGINS: string[];
    CACHE_MAX_AGE: number;
    HOT_RELOAD_ENABLED: boolean;
    WEBSOCKET_ENABLED: boolean;
    FILE_WATCHING_ENABLED: boolean;
    WEBSOCKET_PATH: string;
    FILE_WATCH_DEBOUNCE: number;
    SUPPRESS_MODULE_DIRECTIVE_WARNINGS: boolean;
    CSP_DIRECTIVES: Record<string, string[]>;
    BASE_PATH: string;
    TRUST_PROXY: number | string | string[];
}

/**
 * Type validators for each config key
 * Keys in this object define the whitelist of allowed configuration keys
 */
const CONFIG_VALIDATORS: Record<keyof ServerConfig, (value: unknown) => boolean> = {
    PORT: (v) => typeof v === 'number' && v > 0 && v <= 65535,
    NODE_ENV: (v) => typeof v === 'string' && ['development', 'production', 'test'].includes(v),
    PROJECT_ROOT: (v) => typeof v === 'string' && v.length > 0 && v.length < 1024,
    BUILD_DIR: (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/.test(v) && v.length < 64,
    REQUEST_TIMEOUT: (v) => typeof v === 'number' && v > 0 && v <= 300000,
    BODY_SIZE_LIMIT: (v) => typeof v === 'string' && /^\d+(kb|mb|gb)?$/i.test(v),
    RATE_LIMIT_WINDOW: (v) => typeof v === 'number' && v > 0 && v <= 86400000,
    RATE_LIMIT_MAX: (v) => typeof v === 'number' && v > 0 && v <= 10000,
    REVALIDATE_RATE_LIMIT_MAX: (v) => typeof v === 'number' && v > 0 && v <= 1000,
    REVALIDATE_API_KEY: (v) => typeof v === 'string' && v.length >= 16 && v.length <= 256,
    REVALIDATE_REQUEST_TIMEOUT: (v) => typeof v === 'number' && v > 0 && v <= 600000,
    CORS_ORIGINS: (v) => Array.isArray(v) && v.every((o) => typeof o === 'string' && /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(o)),
    CACHE_MAX_AGE: (v) => typeof v === 'number' && v >= 0 && v <= 31536000,
    HOT_RELOAD_ENABLED: (v) => typeof v === 'boolean',
    WEBSOCKET_ENABLED: (v) => typeof v === 'boolean',
    FILE_WATCHING_ENABLED: (v) => typeof v === 'boolean',
    WEBSOCKET_PATH: (v) => typeof v === 'string' && /^\/[a-zA-Z0-9_-]*$/.test(v),
    FILE_WATCH_DEBOUNCE: (v) => typeof v === 'number' && v >= 0 && v <= 10000,
    SUPPRESS_MODULE_DIRECTIVE_WARNINGS: (v) => typeof v === 'boolean',
    CSP_DIRECTIVES: (v) => typeof v === 'object' && v !== null && !Array.isArray(v) &&
        Object.values(v as Record<string, unknown>).every(arr =>
            Array.isArray(arr) && arr.every(s => typeof s === 'string')
        ),
    BASE_PATH: (v) => typeof v === 'string' && v.length <= 256 &&
        (v === '' || (v.startsWith('/') && /^[a-zA-Z0-9/_-]+$/.test(v))),
    TRUST_PROXY: (v) =>
        (typeof v === 'number' && Number.isInteger(v) && v > 0) ||
        (typeof v === 'string' && v.length > 0) ||
        (Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && s.length > 0)),
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
    REVALIDATE_REQUEST_TIMEOUT: 2 * 60 * 1000, // 2 minutes
    CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',').filter(Boolean) || [], // Allowed CORS origins (empty = same-origin only in prod, localhost in dev)
    CACHE_MAX_AGE: process.env.NODE_ENV === 'production' ? 86400 : 0, // 1 day in prod, no cache in dev

    // Hot reload configuration
    HOT_RELOAD_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_ENABLED: process.env.NODE_ENV === 'development',
    FILE_WATCHING_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_PATH: '/ws',
    FILE_WATCH_DEBOUNCE: 300, // milliseconds
    SUPPRESS_MODULE_DIRECTIVE_WARNINGS: false,
    CSP_DIRECTIVES: {},
    BASE_PATH: '',
    TRUST_PROXY: 1,
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
 * Transpile and load a TypeScript config file using esbuild (available via Vite)
 */
const loadTsConfigWithEsbuild = async (configPath: string): Promise<Record<string, unknown> | null> => {
    try {
        const esbuild = await import('esbuild');
        const tsContent = fs.readFileSync(configPath, 'utf-8');
        const { code } = await esbuild.transform(tsContent, { loader: 'ts', format: 'esm' });
        const tempFile = path.join(os.tmpdir(), `static-config-${Date.now()}.mjs`);
        fs.writeFileSync(tempFile, code);
        try {
            return await import(tempFile);
        } finally {
            fs.unlinkSync(tempFile);
        }
    } catch {
        return null;
    }
};

/**
 * Load user configuration from static.config.js or static.config.ts in the project root
 * Validates all loaded values against a strict schema
 */
const loadUserConfig = async (): Promise<Partial<ServerConfig>> => {
    const projectRoot = path.resolve(process.cwd());

    // Check for config files in order of preference (JS first, then TS)
    const configFiles = [
        { path: path.join(projectRoot, 'static.config.js'), name: 'static.config.js' },
        { path: path.join(projectRoot, 'static.config.mjs'), name: 'static.config.mjs' },
        { path: path.join(projectRoot, 'static.config.ts'), name: 'static.config.ts' },
    ];

    let configPath: string | null = null;
    let configName: string = '';

    for (const config of configFiles) {
        if (fs.existsSync(config.path)) {
            configPath = config.path;
            configName = config.name;
            break;
        }
    }

    if (!configPath) {
        return {};
    }

    try {
        let imported;

        try {
            imported = await import(configPath);
        } catch (importError) {
            // If direct import fails for a .ts file, try transpiling with esbuild
            if (configName.endsWith('.ts')) {
                imported = await loadTsConfigWithEsbuild(configPath);
            }
            if (!imported) throw importError;
        }

        const rawConfig = imported.default || imported.CONFIG || {};

        // Validate and sanitize the loaded configuration
        const validatedConfig = validateUserConfig(rawConfig);

        if (Object.keys(validatedConfig).length > 0) {
            console.log(`[Config] Loaded user configuration from ${configName}`);
        }

        return validatedConfig;
    } catch (error) {
        const errorMessage = (error as Error).message;
        console.warn(`[Config] Failed to load ${configName}: ${errorMessage}`);
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

    // Normalize BASE_PATH: strip trailing slashes, convert '/' to ''
    if (merged.BASE_PATH) {
        merged.BASE_PATH = merged.BASE_PATH.replace(/\/+$/, '');
        if (merged.BASE_PATH === '') {
            merged.BASE_PATH = '';
        }
    }

    return merged;
};

// Load user config and merge with defaults using top-level await
const userConfig = await loadUserConfig();
export const CONFIG: ServerConfig = mergeConfigs(DEFAULT_CONFIG, userConfig);

export const isDevelopment: boolean = CONFIG.NODE_ENV === 'development';
export const isProduction: boolean = CONFIG.NODE_ENV === 'production';
