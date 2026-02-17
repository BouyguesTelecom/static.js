/**
 * Security middleware configuration
 * Handles helmet, CORS, and other security-related middleware
 */

import helmet from "helmet";
import cors from "cors";
import { Express, Request } from "express";
import { CONFIG, isDevelopment } from "../config/index.js";

/**
 * Build CSP directives by merging defaults with user config.
 * User-provided sources are appended to the defaults (not replaced).
 */
const buildCspDirectives = (): Record<string, string[]> => {
    const defaults: Record<string, string[]> = {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://assets.bouyguestelecom.fr"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
    };

    for (const [key, values] of Object.entries(CONFIG.CSP_DIRECTIVES)) {
        if (defaults[key]) {
            const merged = new Set([...defaults[key], ...values]);
            defaults[key] = [...merged];
        } else {
            defaults[key] = values;
        }
    }

    return defaults;
};

/**
 * Security headers middleware using helmet
 * Configures appropriate security headers for the application
 */
export const securityMiddleware = helmet({
    contentSecurityPolicy: {
        directives: buildCspDirectives(),
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for development
});

/**
 * Get allowed origins for CORS
 * In development: allows localhost origins if none configured
 * In production: only allows explicitly configured origins
 */
const getAllowedOrigins = (): string[] => {
    if (CONFIG.CORS_ORIGINS.length > 0) {
        return CONFIG.CORS_ORIGINS;
    }

    // Default localhost origins for development
    if (isDevelopment) {
        return [
            `http://localhost:${CONFIG.PORT}`,
            `http://127.0.0.1:${CONFIG.PORT}`,
            'http://localhost:3000',
            'http://127.0.0.1:3000',
        ];
    }

    // In production with no configured origins, deny all cross-origin requests
    return [];
};

/**
 * CORS origin validator
 * Validates request origin against allowed origins list
 */
const corsOriginValidator = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
): void => {
    const allowedOrigins = getAllowedOrigins();

    // Allow requests with no origin (same-origin, curl, etc.)
    if (!origin) {
        callback(null, true);
        return;
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
    }

    // In development, log rejected origins for debugging
    if (isDevelopment) {
        console.warn(`[CORS] Rejected origin: ${origin}. Allowed: ${allowedOrigins.join(', ') || 'none'}`);
    }

    callback(new Error('Not allowed by CORS'), false);
};

/**
 * CORS configuration
 * Uses origin validator for secure cross-origin request handling
 */
export const corsMiddleware = cors({
    origin: corsOriginValidator,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400, // 24 hours preflight cache
});

/**
 * Apply security middleware to Express app
 */
export const applySecurity = (app: Express): void => {
    app.use(securityMiddleware);
    app.use(corsMiddleware);
};
