/**
 * Static file serving middleware configuration
 * Handles static file serving with proper cache headers
 */

import express, { Request, Response, NextFunction, Express } from "express";
import { extname, resolve, join } from "path";
import { existsSync } from "fs";
import { CONFIG, isDevelopment } from "../config/index.js";

/**
 * Apply static file serving middleware to Express app
 */
export const applyStatic = (app: Express): void => {
    /**
     * Clean URL rewrite: /guide-pratique -> /guide-pratique.html
     * Must run before express.static so .html files are found
     * even when a directory with the same name exists.
     */
    app.use((req: Request, _res: Response, next: NextFunction) => {
        // Skip requests that already have a file extension
        if (extname(req.path)) return next();

        const htmlFile = resolve(CONFIG.BUILD_DIR, req.path.slice(1) + '.html');
        if (existsSync(htmlFile)) {
            req.url = req.path + '.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
        }
        next();
    });

    /**
     * Enhanced static file serving with proper cache headers
     * In development mode, exclude JavaScript files so they can be handled by Vite
     */
    app.use((req: Request, res: Response, next: NextFunction) => {
        // In development mode, skip JavaScript files - let Vite handle them
        if (isDevelopment && req.path.endsWith('.js')) {
            return next();
        }

        express.static(CONFIG.BUILD_DIR, {
            maxAge: CONFIG.CACHE_MAX_AGE * 1000,
            etag: true,
            lastModified: true,
            setHeaders: (res: Response, path: string) => {
                const ext = extname(path).toLowerCase();

                if (['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
                    if (ext === '.js' && isDevelopment) {
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                    } else {
                        res.setHeader('Cache-Control', `public, max-age=${CONFIG.CACHE_MAX_AGE}`);
                    }
                } else if (['.html', '.htm'].includes(ext)) {
                    res.setHeader('Cache-Control', isDevelopment ? 'no-cache' : `public, max-age=${CONFIG.CACHE_MAX_AGE / 24}`);
                }

                res.setHeader('X-Content-Type-Options', 'nosniff');
            },
        })(req, res, next);
    });
};
