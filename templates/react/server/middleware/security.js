/**
 * Security middleware configuration
 * Handles helmet, CORS, and other security-related middleware
 */

import helmet from "helmet";
import cors from "cors";
import { isDevelopment } from "../config/index.js";

/**
 * Security headers middleware using helmet
 * Configures appropriate security headers for the application
 */
export const securityMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for development
});

/**
 * CORS configuration for development
 * Allows cross-origin requests in development mode
 */
export const corsMiddleware = cors({
    origin: true,
    credentials: true,
});

/**
 * Apply security middleware to Express app
 */
export const applySecurity = (app) => {
    app.use(securityMiddleware);
    
    if (isDevelopment) {
        app.use(corsMiddleware);
    }
};