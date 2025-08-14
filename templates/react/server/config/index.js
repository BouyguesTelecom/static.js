/**
 * Server configuration constants
 * Centralized configuration for the StaticJS React template server
 */

export const CONFIG = {
    PORT: process.env.PORT || 3456,
    NODE_ENV: process.env.NODE_ENV || 'development',
    STATIC_DIR: 'dist',
    REQUEST_TIMEOUT: 30000, // 30 seconds
    BODY_SIZE_LIMIT: '10mb',
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100, // requests per window
    REVALIDATE_RATE_LIMIT_MAX: 10, // stricter limit for revalidate endpoint
    CACHE_MAX_AGE: process.env.NODE_ENV === 'production' ? 86400 : 0, // 1 day in prod, no cache in dev
};

export const isDevelopment = CONFIG.NODE_ENV === 'development';
export const isProduction = CONFIG.NODE_ENV === 'production';
