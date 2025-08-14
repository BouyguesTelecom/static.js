/**
 * Logging middleware configuration
 * Handles request logging with timestamps and details
 */

/**
 * Request logging middleware with timestamps and details
 */
export const loggingMiddleware = (req, res, next) => {
    const timestamp = new Date().toISOString();
    // Log response time
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`[${timestamp}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    });

    next();
};

/**
 * Apply logging middleware to Express app
 */
export const applyLogging = (app) => {
    app.use(loggingMiddleware);
};
