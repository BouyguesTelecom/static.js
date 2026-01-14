/**
 * Server configuration constants
 * Centralized configuration for the StaticJS React template server
 */
import * as path from "node:path";
import { readFileSync } from "node:fs";

// Load environment variables from .env file manually
try {
    const envPath = path.resolve(process.cwd(), '.env');
    const envFile = readFileSync(envPath, 'utf8');
    
    envFile.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, ...valueParts] = trimmedLine.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim();
                // Only set if not already defined in process.env
                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = value;
                    // Debug: log loaded variables (except sensitive ones)
                    if (key.trim() !== 'REVALIDATE_TOKEN') {
                        console.log(`[Config] Loaded ${key.trim()}=${value}`);
                    } else {
                        console.log(`[Config] Loaded ${key.trim()}=****** (${value.length} chars)`);
                    }
                }
            }
        }
    });
    console.log('[Config] Environment variables loaded from .env file');
} catch (error) {
    console.log('[Config] No .env file found, using system environment variables only');
}

export interface ServerConfig {
    PORT: number;
    HOST: string;
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
    REVALIDATE_TOKEN?: string;
}

export const CONFIG: ServerConfig = {
    PORT: Number(process.env.PORT) || 3456,
    HOST: process.env.HOST || '127.0.0.1', // Écouter seulement sur localhost par défaut
    NODE_ENV: process.env.NODE_ENV || 'development',
    PROJECT_ROOT: path.resolve(process.cwd()),
    BUILD_DIR: '_build',
    REQUEST_TIMEOUT: 30000, // 30 seconds
    BODY_SIZE_LIMIT: '1mb', // Réduire la limite pour la sécurité
    RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX: 100, // Réduire le nombre de requêtes autorisées
    REVALIDATE_RATE_LIMIT_MAX: 10, // Limite encore plus stricte pour revalidate
    CACHE_MAX_AGE: process.env.NODE_ENV === 'production' ? 86400 : 0, // 1 day in prod, no cache in dev

    // Hot reload configuration
    HOT_RELOAD_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_ENABLED: process.env.NODE_ENV === 'development',
    FILE_WATCHING_ENABLED: process.env.NODE_ENV === 'development',
    WEBSOCKET_PATH: '/ws',
    FILE_WATCH_DEBOUNCE: 300, // milliseconds
    
    // Revalidate token for secure cache revalidation
    REVALIDATE_TOKEN: process.env.REVALIDATE_TOKEN,
};

export const isDevelopment: boolean = CONFIG.NODE_ENV === 'development';
export const isProduction: boolean = CONFIG.NODE_ENV === 'production';
