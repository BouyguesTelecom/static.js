/**
 * Runtime rendering middleware configuration
 * Handles development mode runtime page rendering and JavaScript serving
 */

import { Request, Response, NextFunction, Express } from "express";
import { ViteDevServer } from "vite";
import { renderPageRuntime } from "../../helpers/renderPageRuntime.js";
import { isDevelopment } from "../index.js";
import { CONFIG } from "../config/index.js";
import { readPages } from "../../helpers/readPages.js";
import { findStyleFiles } from "../../helpers/styleDiscovery.js";
import fs from "fs";
import path from "path";

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
        // Cache invalidation (silent)
        pageCache.clear();
        lastCacheInvalidation = Date.now();
        
        // Import Vite server using ES modules
        const { getViteServer } = await import('../utils/vite.js');
        const viteServer = getViteServer();
        
        if (viteServer) {
            // Check if Vite has module graph and invalidate caches
            if (viteServer.moduleGraph) {
                viteServer.moduleGraph.invalidateAll();
                
                // Clear Vite's transform cache if it exists
                if ((viteServer as any).transformCache && typeof (viteServer as any).transformCache.clear === 'function') {
                    (viteServer as any).transformCache.clear();
                }
                
                // Clear Vite's internal caches if they exist
                if ((viteServer as any).ssrTransform && typeof (viteServer as any).ssrTransform.clear === 'function') {
                    (viteServer as any).ssrTransform.clear();
                }
            }
        }
        
        // Force garbage collection to clear any remaining cached modules
        if (global.gc) {
            global.gc();
        }
        
        // Cache invalidation completed
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
    // Also skip requests under BASE_PATH — those are asset requests, not pages
    if (req.method === 'GET' && !req.path.match(/\.(js|css|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)
        && !(CONFIG.BASE_PATH && req.path.startsWith(CONFIG.BASE_PATH + '/'))) {
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
                    // Serving cached content
                }
            }
            
            // If no valid cached content, render fresh
            if (!htmlContent) {
                // Rendering fresh content
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
    // Register specific routes for each page's JavaScript file
    const pagesCache: PagesCache = JSON.parse(fs.readFileSync(`./${CONFIG.BUILD_DIR}/cache/pagesCache.json`, 'utf8'));
    const excludedFiles: string[] = JSON.parse(fs.readFileSync(`./${CONFIG.BUILD_DIR}/cache/excludedFiles.json`, 'utf8'));

    const basePath = CONFIG.BASE_PATH;

    // Register a route for each page's JS file (skip dynamic routes)
    Object.keys(pagesCache).forEach(pageName => {
        if (!excludedFiles.includes(pageName) && !pageName.includes('[') && !pageName.includes(']')) {
            const jsRoute = `${basePath}/${pageName}.js`;
            // Registering JS route for page
            app.get(jsRoute, async (req: Request, res: Response): Promise<any> => {
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

                    // Check file modification time and invalidate cache if needed
                    const stats = fs.statSync(pagesCache[pageName]);
                    const fileModTime = stats.mtime.getTime();

                    if (fileModTime > lastCacheInvalidation && viteServer.moduleGraph) {
                        const moduleId = pagesCache[pageName];
                        const module = viteServer.moduleGraph.getModuleById(moduleId);
                        if (module) {
                            viteServer.moduleGraph.invalidateModule(module);
                        }
                    }

                    // Transform the page file using Vite
                    const transformStartTime = Date.now();
                    const result = await viteServer.transformRequest(`${pagesCache[pageName]}?t=${transformStartTime}`, {
                        ssr: false
                    });

                    if (result && result.code) {
                        // Create a hash of the code for cache busting
                        const crypto = await import('crypto');
                        const codeHash = crypto.createHash('md5').update(result.code).digest('hex').slice(0, 8);
                        
                        res.setHeader('Content-Type', 'application/javascript');
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        res.setHeader('X-Timestamp', Date.now().toString());
                        res.setHeader('X-Code-Hash', codeHash);
                        res.setHeader('X-File-Modified', fileModTime.toString());
                        return res.send(result.code);
                    } else {
                        return res.status(404).json({
                            success: false,
                            error: 'Not Found',
                            message: `No JavaScript generated for ${pageName}`,
                        });
                    }
                } catch (error) {
                    console.error(`Error compiling JavaScript for ${pageName}:`, error);
                    return res.status(500).json({
                        success: false,
                        error: 'Internal Server Error',
                        message: `Failed to compile JavaScript for ${pageName}`,
                    });
                }
            });
        } else if (pageName.includes('[') || pageName.includes(']')) {
            // Dynamic routes: register JS route with param name (e.g., partials/dynamic/[id] -> /partials/dynamic/id.js)
            const jsRoute = `${basePath}/${pageName.replace(/\[([^\]]+)\]/g, '$1')}.js`;
            app.get(jsRoute, async (req: Request, res: Response): Promise<any> => {
                try {
                    const pageContent = fs.readFileSync(pagesCache[pageName], 'utf8');
                    const firstLine = pageContent.split('\n')[0];

                    if (firstLine.includes('no scripts')) {
                        return res.status(404).json({
                            success: false,
                            error: 'Not Found',
                            message: `JavaScript disabled for ${pageName}`,
                        });
                    }

                    const stats = fs.statSync(pagesCache[pageName]);
                    const fileModTime = stats.mtime.getTime();

                    if (fileModTime > lastCacheInvalidation && viteServer.moduleGraph) {
                        const moduleId = pagesCache[pageName];
                        const module = viteServer.moduleGraph.getModuleById(moduleId);
                        if (module) {
                            viteServer.moduleGraph.invalidateModule(module);
                        }
                    }

                    const transformStartTime = Date.now();
                    const result = await viteServer.transformRequest(`${pagesCache[pageName]}?t=${transformStartTime}`, {
                        ssr: false
                    });

                    if (result && result.code) {
                        const crypto = await import('crypto');
                        const codeHash = crypto.createHash('md5').update(result.code).digest('hex').slice(0, 8);

                        res.setHeader('Content-Type', 'application/javascript');
                        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                        res.setHeader('Pragma', 'no-cache');
                        res.setHeader('Expires', '0');
                        res.setHeader('X-Timestamp', Date.now().toString());
                        res.setHeader('X-Code-Hash', codeHash);
                        res.setHeader('X-File-Modified', fileModTime.toString());
                        return res.send(result.code);
                    } else {
                        return res.status(404).json({
                            success: false,
                            error: 'Not Found',
                            message: `No JavaScript generated for ${pageName}`,
                        });
                    }
                } catch (error) {
                    console.error(`Error compiling JavaScript for ${pageName}:`, error);
                    return res.status(500).json({
                        success: false,
                        error: 'Internal Server Error',
                        message: `Failed to compile JavaScript for ${pageName}`,
                    });
                }
            });
        }
    });
};

/**
 * Register dynamic CSS serving middleware
 * Discovers style files on each request so newly created/deleted/renamed
 * style files are always picked up without a server restart
 */
export const registerCSSMiddleware = (app: Express, viteServer: ViteDevServer): void => {
    const pagesDir = path.resolve(process.cwd(), "src/pages");
    const rootDir = path.resolve(process.cwd(), "src");

    const escapedBasePath = CONFIG.BASE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cssPattern = new RegExp(`^${escapedBasePath}/(.+)\\.css$`);

    app.get(cssPattern, async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
            const pageName = req.params[0];
            if (!pageName) return next();

            // Discover pages dynamically (live filesystem scan)
            const pages = readPages(pagesDir);

            // Find matching page (handle dynamic routes: "blog/category" matches "blog/[slug]")
            let pagePath: string | null = null;
            for (const [name, filePath] of Object.entries(pages)) {
                const normalizedName = name.replace(/\[([^\]]+)\]/g, '$1');
                if (normalizedName === pageName) {
                    pagePath = filePath;
                    break;
                }
            }

            if (!pagePath) return next();

            // Discover style files dynamically (global -> layout -> page)
            const styleFiles = findStyleFiles(pagePath, rootDir);
            if (styleFiles.length === 0) return next();

            // Compile styles using Vite
            const compiledStyles: string[] = [];

            for (const styleFile of styleFiles) {
                // Invalidate all Vite modules associated with this file
                // so that transformRequest re-reads from disk
                if (viteServer.moduleGraph) {
                    const modules = viteServer.moduleGraph.getModulesByFile(styleFile);
                    if (modules) {
                        for (const mod of modules) {
                            viteServer.moduleGraph.invalidateModule(mod);
                        }
                    }
                }

                // Transform the style file using Vite (no ?t= to avoid
                // creating orphan module entries in the graph)
                const result = await viteServer.transformRequest(
                    styleFile,
                    { ssr: false }
                );

                if (result && result.code) {
                    const cssMatch = result.code.match(/__vite__css\s*=\s*"((?:[^"\\]|\\.)*)"/) ||
                                     result.code.match(/export\s+default\s+"((?:[^"\\]|\\.)*)"/) ||
                                     result.code.match(/"((?:[^"\\]|\\.)*\\n(?:[^"\\]|\\.)*)"/);

                    if (cssMatch && cssMatch[1]) {
                        const css = cssMatch[1]
                            .replace(/\\n/g, "\n")
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, "\\");
                        compiledStyles.push(`/* Source: ${path.basename(styleFile)} */\n${css}`);
                    }
                }
            }

            if (compiledStyles.length > 0) {
                const finalCss = compiledStyles.join("\n\n");

                res.setHeader("Content-Type", "text/css");
                res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
                res.setHeader("Pragma", "no-cache");
                res.setHeader("Expires", "0");
                return res.send(finalCss);
            } else {
                return next();
            }
        } catch (error) {
            console.error(`Error compiling CSS for ${req.path}:`, error);
            return next();
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
