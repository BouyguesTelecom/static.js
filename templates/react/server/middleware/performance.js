/**
 * Performance middleware configuration
 * Handles compression, timeouts, and other performance-related middleware
 */

import compression from "compression";
import { CONFIG } from "../config/index.js";

/**
 * Request timeout middleware
 */
export const timeoutMiddleware = (req, res, next) => {
    req.setTimeout(CONFIG.REQUEST_TIMEOUT, () => {
        const err = new Error('Request timeout');
        err.status = 408;
        next(err);
    });
    next();
};

/**
 * Apply performance middleware to Express app
 */
export const applyPerformance = (app) => {
    // Compression middleware for response optimization
    app.use(compression());
    
    // Request timeout middleware
    app.use(timeoutMiddleware);
};