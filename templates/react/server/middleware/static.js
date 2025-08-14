/**
 * Static file serving middleware configuration
 * Handles static file serving with proper cache headers
 */

import express from "express";
import { extname } from "path";
import { CONFIG, isDevelopment } from "../config/index.js";

/**
 * Apply static file serving middleware to Express app
 */
export const applyStatic = (app) => {
    /**
     * Enhanced static file serving with proper cache headers
     */
    app.use(express.static(CONFIG.STATIC_DIR, {
        maxAge: CONFIG.CACHE_MAX_AGE * 1000, // Convert to milliseconds
        etag: true,
        lastModified: true,
        setHeaders: (res, path) => {
            // Set cache headers based on file type
            const ext = extname(path).toLowerCase();

            if (['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
                // Cache static assets for longer
                res.setHeader('Cache-Control', `public, max-age=${CONFIG.CACHE_MAX_AGE}`);
            } else if (['.html', '.htm'].includes(ext)) {
                // Don't cache HTML files in development
                res.setHeader('Cache-Control', isDevelopment ? 'no-cache' : `public, max-age=${CONFIG.CACHE_MAX_AGE / 24}`);
            }

            // Security headers for static files
            res.setHeader('X-Content-Type-Options', 'nosniff');
        },
    }));
};