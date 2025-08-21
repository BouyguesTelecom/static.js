/**
 * Server configuration constants
 * Centralized configuration for the StaticJS React template server
 */
import * as path from "node:path";

export interface ServerConfig {
    PORT: number;
    NODE_ENV: string;
    PROJECT_ROOT: string;
    STATIC_DIR: string;
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

export const CONFIG: ServerConfig = {
    PORT: Number(process.env.PORT) || 3456,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PROJECT_ROOT: path.resolve(process.cwd()),
    STATIC_DIR: '_build',
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

export const isDevelopment: boolean = CONFIG.NODE_ENV === 'development';
export const isProduction: boolean = CONFIG.NODE_ENV === 'production';
