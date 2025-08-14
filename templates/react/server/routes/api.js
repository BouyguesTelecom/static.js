/**
 * API route handlers
 * Handles health check, pages listing, and revalidate endpoints
 */

import { revalidate } from "../../../../scripts/revalidate.js";
import { getAvailablePagesRuntime } from "../../../../helpers/renderPageRuntime.js";
import { readdir } from "fs/promises";
import { extname, join } from "path";
import { CONFIG, isDevelopment } from "../config/index.js";
import { revalidateLimiter } from "../middleware/rateLimiting.js";

/**
 * Health check endpoint
 * Returns server status and basic information
 */
export const healthCheck = (req, res) => {
    const healthInfo = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: CONFIG.NODE_ENV,
        version: process.version,
        memory: process.memoryUsage(),
    };

    res.status(200).json(healthInfo);
};

/**
 * API endpoint to list available pages
 * In development mode, uses readPages helper; in production, scans static directory
 */
export const listPages = async (req, res) => {
    try {
        let pages;

        if (isDevelopment) {
            // Use runtime pages discovery in development
            const runtimePages = getAvailablePagesRuntime();
            pages = Object.keys(runtimePages).map(pageName => ({
                name: `${pageName}.tsx`,
                path: pageName === 'index' ? '/' : `/${pageName}`,
                file: runtimePages[pageName],
            }));
        } else {
            // Use static file scanning in production
            pages = await getAvailablePages();
        }

        res.status(200).json({
            success: true,
            pages,
            count: pages.length,
            mode: isDevelopment ? 'development (runtime)' : 'production (static)',
        });
    } catch (error) {
        console.error('Error listing pages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list available pages',
            message: isDevelopment ? error.message : 'Internal server error',
        });
    }
};

/**
 * Revalidate endpoint with enhanced error handling and rate limiting
 */
export const revalidateEndpoint = async (req, res) => {
    try {
        await revalidate(req, res);
    } catch (error) {
        console.error('Revalidate error:', error);
        res.status(500).json({
            success: false,
            error: 'Revalidation failed',
            message: isDevelopment ? error.message : 'Internal server error',
        });
    }
};

/**
 * Scans the static directory for available HTML pages
 * @returns {Promise<Array>} Array of available page paths
 */
async function getAvailablePages() {
    const pages = [];

    try {
        const scanDirectory = async (dir, basePath = '') => {
            const items = await readdir(join(CONFIG.STATIC_DIR, dir), {withFileTypes: true});

            for (const item of items) {
                const itemPath = join(dir, item.name);
                const urlPath = join(basePath, item.name);

                if (item.isDirectory()) {
                    await scanDirectory(itemPath, urlPath);
                } else if (item.isFile() && extname(item.name).toLowerCase() === '.html') {
                    const pagePath = urlPath.replace(/\.html$/, '').replace(/\\/g, '/');
                    pages.push({
                        name: item.name,
                        path: pagePath === 'index' ? '/' : `/${pagePath}`,
                        file: itemPath.replace(/\\/g, '/'),
                    });
                }
            }
        };

        await scanDirectory('');
    } catch (error) {
        console.warn('Could not scan pages directory:', error.message);
    }

    return pages.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Register API routes with Express app
 */
export const registerApiRoutes = (app) => {
    app.get('/health', healthCheck);
    app.get('/api/pages', listPages);
    app.post('/revalidate', revalidateLimiter, revalidateEndpoint);
};