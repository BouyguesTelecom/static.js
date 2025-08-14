/**
 * Runtime rendering middleware configuration
 * Handles development mode runtime page rendering and JavaScript serving
 */

import {renderPageRuntime} from "../../../../helpers/renderPageRuntime.js";
import {isDevelopment} from "../config/index.js";
import fs from "fs";

/**
 * Runtime page rendering middleware for development mode
 * Uses renderPageRuntime which handles all page resolution and dynamic routing
 */
export const runtimeRenderingMiddleware = async (req, res, next) => {
    // Only handle GET requests for pages, but skip static assets and JS files
    if (req.method === 'GET' && !req.path.match(/\.(js|css|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
        /**
         * Handle runtime rendering for development mode
         * Leverages renderPageRuntime's bui lt-in page resolution and parameter handling
         */
        try {
            // renderPageRuntime handles all page resolution, dynamic routing, and parameter extraction
            const htmlContent = await renderPageRuntime(req.path);

            if (htmlContent) {
                res.setHeader('Content-Type', 'text/html');
                res.setHeader('Cache-Control', 'no-cache'); // No cache in development
                return res.send(htmlContent);
            } else {
                // Continue to next middleware (static files or 404)
                return next();
            }
        } catch (error) {
            // Continue to next middleware on error
            return next();
        }
    } else {
        next();
    }
};

/**
 * Register JavaScript serving middleware for each page
 */
export const registerJavaScriptMiddleware = (app, viteServer) => {
    console.log('[JS Serving] Registering JavaScript serving middleware');

    // Register specific routes for each page's JavaScript file
    const pagesCache = JSON.parse(fs.readFileSync('./cache/pagesCache.json', 'utf8'));
    const excludedFiles = JSON.parse(fs.readFileSync('./cache/excludedFiles.json', 'utf8'));

    // Register a route for each page's JS file (skip dynamic routes)
    Object.keys(pagesCache).forEach(pageName => {
        if (!excludedFiles.includes(pageName) && !pageName.includes('[') && !pageName.includes(']')) {
            const jsRoute = `/${pageName}.js`;
            app.get(jsRoute, async (req, res) => {
                try {
                    // Check if the page file has "no scripts" directive
                    const pageContent = fs.readFileSync(pagesCache[pageName], 'utf8');
                    const firstLine = pageContent.split('\n')[0];

                    if (firstLine.includes('no scripts')) {
                        return res.status(404).json({
                            success: false,
                            error: 'Not Found',
                            message: `JavaScript disabled for ${pageName}`,
                        });
                    }

                    // Use Vite to transform the page file
                    const result = await viteServer.transformRequest(pagesCache[pageName]);

                    if (result && result.code) {
                        res.setHeader('Content-Type', 'application/javascript');
                        res.setHeader('Cache-Control', 'no-cache');
                        return res.send(result.code);
                    } else {
                        return res.status(404).json({
                            success: false,
                            error: 'Not Found',
                            message: `No JavaScript generated for ${pageName}`,
                        });
                    }
                } catch (error) {
                    return res.status(500).json({
                        success: false,
                        error: 'Internal Server Error',
                        message: `Failed to compile JavaScript for ${pageName}`,
                    });
                }
            });
        } else if (pageName.includes('[') || pageName.includes(']')) {
        }
    });
};

/**
 * Apply runtime middleware to Express app (development mode only)
 */
export const applyRuntime = (app) => {
    if (isDevelopment) {
        app.use(runtimeRenderingMiddleware);
    }
};
