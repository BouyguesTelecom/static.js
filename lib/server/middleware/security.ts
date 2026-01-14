/**
 * Security middleware configuration
 * Handles helmet, CORS, and other security-related middleware
 */

import helmet from "helmet";
import cors from "cors";
import { Express } from "express";
import { isDevelopment } from "../index.js";

/**
 * Security headers middleware using helmet
 * Configures appropriate security headers for the application
 */
export const securityMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'sha256-'", "'nonce-'"],
            scriptSrc: ["'self'", "'sha256-'", "'nonce-'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for development
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
});

/**
 * CORS configuration
 */
const getAllowedOrigins = (): (string | RegExp)[] => {
    const allowedOrigins: (string | RegExp)[] = [
        'http://localhost:3456',
        'http://127.0.0.1:3456',
    ];
    
    if (isDevelopment) {
        allowedOrigins.push(
            /^http:\/\/localhost:\d+$/,
            /^http:\/\/127\.0\.0\.1:\d+$/,
            'http://localhost:3000', // Vite dev server
            'http://localhost:5173', // Vite default port
        );
    }
    
    const envOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    allowedOrigins.push(...envOrigins);
    
    return allowedOrigins;
};

export const corsMiddleware = cors({
    origin: (origin, callback) => {
        const allowedOrigins = getAllowedOrigins();
        
        if (!origin) {
            return callback(null, true);
        }
        
        // Vérifier si l'origin est autorisée
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            if (typeof allowedOrigin === 'string') {
                return allowedOrigin === origin;
            } else {
                return allowedOrigin.test(origin);
            }
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`[Security] CORS: Origin non autorisée: ${origin}`);
            callback(new Error('Non autorisé par la politique CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'x-revalidate-token'
    ],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400, // 24 heures
});

/**
 * Apply security middleware to Express app
 */
export const applySecurity = (app: Express): void => {
    app.use(securityMiddleware);
    
    if (isDevelopment) {
        app.use(corsMiddleware);
    }
};
