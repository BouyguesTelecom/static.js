/**
 * Static file serving middleware configuration
 * Handles static file serving with proper cache headers
 */

import express, { Request, Response, NextFunction, Express } from "express";
import { extname } from "path";
import { CONFIG, isDevelopment } from "../index";

/**
 * Apply static file serving middleware to Express app
 */
export const applyStatic = (app: Express): void => {
    /**
     * Enhanced static file serving with proper cache headers
     * In development mode, exclude JavaScript files so they can be handled by Vite
     */
    app.use((req: Request, res: Response, next: NextFunction) => {
        // In development mode, skip JavaScript files - let Vite handle them
        if (isDevelopment && req.path.endsWith('.js')) {
            console.log(`[DIAGNOSTIC] Skipping static middleware for JS file in development: ${req.path}`);
            return next();
        }
        
        // Use express.static for non-JS files or in production
        express.static(CONFIG.BUILD_DIR, {
            maxAge: CONFIG.CACHE_MAX_AGE * 1000, // Convert to milliseconds
            etag: true,
            lastModified: true,
            setHeaders: (res: Response, path: string) => {
                // Set cache headers based on file type
                const ext = extname(path).toLowerCase();

                // DIAGNOSTIC: Log static file serving
                if (ext === '.js') {
                    console.log(`[DIAGNOSTIC] Static middleware serving JS file: ${path}`);
                    console.log(`[DIAGNOSTIC] Cache max age: ${CONFIG.CACHE_MAX_AGE}`);
                    console.log(`[DIAGNOSTIC] Is development: ${isDevelopment}`);
                }

                if (['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
                    if (ext === '.js' && isDevelopment) {
                        // Don't cache JavaScript files in development to prevent stale code
                        const cacheControl = 'no-cache, no-store, must-revalidate';
                        res.setHeader('Cache-Control', cacheControl);
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        console.log(`[DIAGNOSTIC] Setting no-cache for JS in development: ${cacheControl}`);
                    } else {
                        // Cache static assets for longer in production
                        const cacheControl = `public, max-age=${CONFIG.CACHE_MAX_AGE}`;
                        res.setHeader('Cache-Control', cacheControl);
                        if (ext === '.js') {
                            console.log(`[DIAGNOSTIC] Setting Cache-Control for JS: ${cacheControl}`);
                        }
                    }
                } else if (['.html', '.htm'].includes(ext)) {
                    // Don't cache HTML files in development
                    res.setHeader('Cache-Control', isDevelopment ? 'no-cache' : `public, max-age=${CONFIG.CACHE_MAX_AGE / 24}`);
                }

                // Security headers for static files
                res.setHeader('X-Content-Type-Options', 'nosniff');
            },
        })(req, res, next);
    });
};
