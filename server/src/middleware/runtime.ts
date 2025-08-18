/**
 * Runtime rendering middleware configuration
 * Handles development mode runtime page rendering and JavaScript serving
 */

import { Request, Response, NextFunction, Express } from "express";
import { ViteDevServer } from "vite";
import { renderPageRuntime } from "../helpers/renderPageRuntime.js";
import { isDevelopment } from "../config/index.js";
import fs from "fs";

interface CachedPage {
    content: string;
    timestamp: number;
}

interface PagesCache {
    [pageName: string]: string;
}

// Cache for rendered pages and module cache invalidation
let pageCache = new Map<string, CachedPage>();
let lastCacheInvalidation = Date.now();

/**
 * Clear all caches when files change
 */
export const invalidateRuntimeCache = async (): Promise<void> => {
    try {
        console.log('[Runtime] Invalidating runtime cache');
        pageCache.clear();
        lastCacheInvalidation = Date.now();
        
        // Import Vite server using ES modules
        const { getViteServer } = await import('../utils/vite.js');
        const viteServer = getViteServer();
        
        if (viteServer) {
            console.log('[DIAGNOSTIC] Vite server available for cache invalidation');
            
            // Check if Vite has module graph
            if (viteServer.moduleGraph) {
                const moduleCount = viteServer.moduleGraph.idToModuleMap.size;
                console.log(`[DIAGNOSTIC] Vite module graph has ${moduleCount} cached modules`);
                
                // Invalidate all modules in Vite's cache
                viteServer.moduleGraph.invalidateAll();
                console.log('[DIAGNOSTIC] Vite module graph invalidated');
                
                // Also clear Vite's transform cache if it exists
                if ((viteServer as any).transformCache && typeof (viteServer as any).transformCache.clear === 'function') {
                    (viteServer as any).transformCache.clear();
                    console.log('[DIAGNOSTIC] Vite transform cache cleared');
                }
                
                // Clear Vite's internal caches if they exist
                if ((viteServer as any).ssrTransform && typeof (viteServer as any).ssrTransform.clear === 'function') {
                    (viteServer as any).ssrTransform.clear();
                    console.log('[DIAGNOSTIC] Vite SSR transform cache cleared');
                }
            } else {
                console.log('[DIAGNOSTIC] Vite module graph not available');
            }
        } else {
            console.log('[DIAGNOSTIC] Vite server not available for cache invalidation');
        }
        
        // Force garbage collection to clear any remaining cached modules
        if (global.gc) {
            global.gc();
        }
        
        console.log('[Runtime] Cache invalidation completed');
    } catch (error) {
        console.error('[Runtime] Error during cache invalidation:', error);
    }
};

/**
 * Runtime page rendering middleware for development mode
 * Uses renderPageRuntime which handles all page resolution and dynamic routing
 */
export const runtimeRenderingMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only handle GET requests for pages, but skip static assets and JS files
    if (req.method === 'GET' && !req.path.match(/\.(js|css|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
        /**
         * Handle runtime rendering for development mode
         * Leverages renderPageRuntime's built-in page resolution and parameter handling
         */
        try {
            const cacheKey = req.path;
            let htmlContent: string | null = null;
            
            // Check if we have cached content and it's still valid
            if (pageCache.has(cacheKey)) {
                const cached = pageCache.get(cacheKey)!;
                if (cached.timestamp > lastCacheInvalidation) {
                    htmlContent = cached.content;
                    console.log(`[Runtime] Serving cached content for ${req.path}`);
                }
            }
            
            // If no valid cached content, render fresh
            if (!htmlContent) {
                console.log(`[Runtime] Rendering fresh content for ${req.path}`);
                htmlContent = await renderPageRuntime(req.path);
                
                if (htmlContent) {
                    // Cache the rendered content
                    pageCache.set(cacheKey, {
                        content: htmlContent,
                        timestamp: Date.now()
                    });
                }
            }

            if (htmlContent) {
                res.setHeader('Content-Type', 'text/html');
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.send(htmlContent);
                return;
            } else {
                // Continue to next middleware (static files or 404)
                return next();
            }
        } catch (error) {
            console.error('[Runtime] Error rendering page:', error);
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
export const registerJavaScriptMiddleware = (app: Express, viteServer: ViteDevServer): void => {
    console.log('[JS Serving] Registering JavaScript serving middleware');

    // Register specific routes for each page's JavaScript file
    const pagesCache: PagesCache = JSON.parse(fs.readFileSync('./cache/pagesCache.json', 'utf8'));
    const excludedFiles: string[] = JSON.parse(fs.readFileSync('./cache/excludedFiles.json', 'utf8'));

    // Register a route for each page's JS file (skip dynamic routes)
    Object.keys(pagesCache).forEach(pageName => {
        if (!excludedFiles.includes(pageName) && !pageName.includes('[') && !pageName.includes(']')) {
            const jsRoute = `/${pageName}.js`;
            console.log(`[JS Serving] Registering route: ${jsRoute} for page: ${pageName}`);
            app.get(jsRoute, async (req: Request, res: Response): Promise<any> => {
                try {
                    console.log(`[DIAGNOSTIC] JavaScript route handler called for ${jsRoute} (${pageName})`);
                    console.log(`[DIAGNOSTIC] Cache invalidation timestamp: ${lastCacheInvalidation}`);
                    
                    // Check if the page file has "no scripts" directive
                    const pageContent = fs.readFileSync(pagesCache[pageName], 'utf8');
                    const firstLine = pageContent.split('\n')[0];

                    if (firstLine.includes('no scripts')) {
                        console.log(`[DIAGNOSTIC] JavaScript disabled for ${pageName}`);
                        return res.status(404).json({
                            success: false,
                            error: 'Not Found',
                            message: `JavaScript disabled for ${pageName}`,
                        });
                    }

                    // DIAGNOSTIC: Check file modification time
                    const stats = fs.statSync(pagesCache[pageName]);
                    const fileModTime = stats.mtime.getTime();
                    console.log(`[DIAGNOSTIC] File ${pageName} last modified: ${new Date(fileModTime).toISOString()}`);
                    console.log(`[DIAGNOSTIC] Cache last invalidated: ${new Date(lastCacheInvalidation).toISOString()}`);
                    console.log(`[DIAGNOSTIC] File newer than cache: ${fileModTime > lastCacheInvalidation}`);

                    // Force Vite to invalidate this specific module if file is newer than cache
                    if (fileModTime > lastCacheInvalidation && viteServer.moduleGraph) {
                        const moduleId = pagesCache[pageName];
                        const module = viteServer.moduleGraph.getModuleById(moduleId);
                        if (module) {
                            console.log(`[DIAGNOSTIC] Invalidating specific module: ${moduleId}`);
                            viteServer.moduleGraph.invalidateModule(module);
                        }
                    }

                    // Use Vite to transform the page file with forced reload
                    console.log(`[DIAGNOSTIC] Requesting Vite transform for: ${pagesCache[pageName]}`);
                    const result = await viteServer.transformRequest(`${pagesCache[pageName]}?t=${Date.now()}`, {
                        ssr: false
                    });

                    if (result && result.code) {
                        console.log(`[DIAGNOSTIC] Vite transform successful, code length: ${result.code.length}`);
                        
                        // Create a hash of the code for cache busting
                        const crypto = await import('crypto');
                        const codeHash = crypto.createHash('md5').update(result.code).digest('hex').slice(0, 8);
                        console.log(`[DIAGNOSTIC] Code hash: ${codeHash}`);
                        
                        res.setHeader('Content-Type', 'application/javascript');
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        res.setHeader('X-Timestamp', Date.now().toString());
                        res.setHeader('X-Code-Hash', codeHash);
                        res.setHeader('X-File-Modified', fileModTime.toString());
                        return res.send(result.code);
                    } else {
                        console.log(`[DIAGNOSTIC] Vite transform failed or returned no code`);
                        return res.status(404).json({
                            success: false,
                            error: 'Not Found',
                            message: `No JavaScript generated for ${pageName}`,
                        });
                    }
                } catch (error) {
                    console.error(`[DIAGNOSTIC] Error compiling JavaScript for ${pageName}:`, error);
                    return res.status(500).json({
                        success: false,
                        error: 'Internal Server Error',
                        message: `Failed to compile JavaScript for ${pageName}`,
                    });
                }
            });
        } else if (pageName.includes('[') || pageName.includes(']')) {
            // Dynamic routes are handled differently - could add logging here if needed
        }
    });
};

/**
 * Apply runtime middleware to Express app (development mode only)
 */
export const applyRuntime = (app: Express): void => {
    if (isDevelopment) {
        app.use(runtimeRenderingMiddleware);
    }
};