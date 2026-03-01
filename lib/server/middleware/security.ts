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
    // Always allow the server's own origin (needed for module script requests)
    const selfOrigins = [
        `http://localhost:${CONFIG.PORT}`,
        `http://127.0.0.1:${CONFIG.PORT}`,
    ];

    if (CONFIG.CORS_ORIGINS.length > 0) {
        return [...new Set([...selfOrigins, ...CONFIG.CORS_ORIGINS])];
    }

    if (isDevelopment) {
        return [...selfOrigins, 'http://localhost:3000', 'http://127.0.0.1:3000'];
    }

    return selfOrigins;
};

/**
 * CORS origin validator
 * Validates request origin against allowed origins list
 */
const corsOriginValidator = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
): void => {
    // Allow requests with no origin (same-origin, curl, etc.)
    if (!origin) {
        callback(null, true);
        return;
    }

    // In development, allow all origins so reverse proxies work out of the box
    if (isDevelopment) {
        callback(null, true);
        return;
    }

    // Check if origin is in allowed list
    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
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
    // Trust reverse proxies (Caddy, nginx, etc.) so X-Forwarded-For is used
    // for rate limiting and client IP detection
    app.set('trust proxy', CONFIG.TRUST_PROXY);
    app.use(securityMiddleware);
    app.use(corsMiddleware);
};
