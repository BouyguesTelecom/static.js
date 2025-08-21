/**
 * Error handling middleware configuration
 * Handles 404 errors and global error handling
 */

import { Request, Response, NextFunction, Express } from "express";
import { isDevelopment } from "../index";

interface CustomError extends Error {
    status?: number;
    statusCode?: number;
}

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.url}`,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Global error handling middleware
 */
export const globalErrorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction): void => {
    const timestamp = new Date().toISOString();
    const status = err.status || err.statusCode || 500;

    // Log error details
    console.error(`[${timestamp}] Error ${status}:`, {
        message: err.message,
        stack: isDevelopment ? err.stack : undefined,
        url: req.url,
        method: req.method,
        ip: req.ip,
    });

    // Send error response
    res.status(status).json({
        success: false,
        error: status === 500 ? 'Internal Server Error' : err.message,
        message: isDevelopment ? err.message : 'An error occurred',
        timestamp,
        ...(isDevelopment && {stack: err.stack}),
    });
};

/**
 * Apply error handling middleware to Express app
 */
export const applyErrorHandling = (app: Express): void => {
    // 404 handler for unmatched routes
    app.use(notFoundHandler);
    
    // Global error handling middleware
    app.use(globalErrorHandler);
};
