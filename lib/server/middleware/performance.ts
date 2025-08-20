/**
 * Performance middleware configuration
 * Handles compression, timeouts, and other performance-related middleware
 */

import compression from "compression";
import { Request, Response, NextFunction, Express } from "express";
import { CONFIG } from "../config/index.js";

/**
 * Request timeout middleware
 */
export const timeoutMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    req.setTimeout(CONFIG.REQUEST_TIMEOUT, () => {
        const err = new Error('Request timeout') as any;
        err.status = 408;
        next(err);
    });
    next();
};

/**
 * Apply performance middleware to Express app
 */
export const applyPerformance = (app: Express): void => {
    // Compression middleware for response optimization
    app.use(compression());
    
    // Request timeout middleware
    app.use(timeoutMiddleware);
};