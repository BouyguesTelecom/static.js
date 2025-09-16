/**
 * Hot reload middleware
 * Handles client script injection and hot reload static file serving
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request, Response, NextFunction, Express } from 'express';
import { isDevelopment } from '../config/index.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for rendered pages and module cache invalidation
let hotReloadClientScript: string | null = null;

interface HotReloadStatus {
    enabled: boolean;
    scriptLoaded: boolean;
    scriptSize: number;
}

/**
 * Load and cache the hot reload client script
 */
const loadHotReloadScript = (): string => {
    if (!hotReloadClientScript) {
        try {
            // Simplified path resolution - now that build copies static files to _build
            const possiblePaths = [
                // Primary: Relative to compiled middleware (_build/server/middleware -> _build/server/static)
                // Works for both development and npm dependency scenarios
                path.resolve(__dirname, '../static/hot-reload-client.js'),
                
                // Fallback: Source directory (for development when running from source)
                path.resolve(__dirname, '../../server/static/hot-reload-client.js'),
                
                // Safety net: Explicit node_modules path (when used as npm dependency)
                path.join(process.cwd(), 'node_modules/@bouygues-telecom/staticjs/_build/server/static/hot-reload-client.js')
            ];
            
            let scriptPath: string | null = null;
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    scriptPath = possiblePath;
                    break;
                }
            }
            
            if (scriptPath) {
                hotReloadClientScript = fs.readFileSync(scriptPath, 'utf8');
                console.log(`[HotReload] Hot reload client script loaded from: ${scriptPath}`);
            } else {
                throw new Error(`Script not found. Tried paths: ${possiblePaths.join(', ')}`);
            }
        } catch (error) {
            console.error('[HotReload] Failed to load hot reload client script:', error);
            hotReloadClientScript = `
// Hot reload client script fallback
console.log('[HotReload] Hot reload client script not found, using fallback');
`;
        }
    }
    return hotReloadClientScript;
};

/**
 * Middleware to serve hot reload client script
 */
export const hotReloadStaticMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!isDevelopment) {
        return next();
    }

    // Serve hot reload client script - handle this BEFORE any other middleware
    if (req.path === '/hot-reload-client.js' || req.url === '/hot-reload-client.js') {
        console.log('[HotReload] Serving hot reload client script');
        const script = loadHotReloadScript();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send(script);
        return;
    }

    next();
};

/**
 * Middleware to inject hot reload client script into HTML responses
 */
export const hotReloadInjectionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    if (!isDevelopment) {
        return next();
    }

    // Only inject into HTML responses
    const originalSend = res.send;
    
    res.send = function(body: any) {
        // Check if this is an HTML response
        const contentType = res.getHeader('Content-Type') || '';
        const isHtml = contentType.toString().includes('text/html') ||
                      (typeof body === 'string' && (
                          body.trim().startsWith('<!DOCTYPE html>') ||
                          body.includes('<div') ||
                          body.includes('<script')
                      ));

        if (isHtml && typeof body === 'string') {
            // Inject hot reload script
            const hotReloadScript = `
    <!-- Hot Reload Client Script (Development Only) -->
    <script src="/hot-reload-client.js"></script>`;

            // Try different injection strategies
            let injected = false;
            
            // Strategy 1: Before closing body tag
            const bodyCloseIndex = body.lastIndexOf('</body>');
            if (bodyCloseIndex !== -1) {
                body = body.slice(0, bodyCloseIndex) + hotReloadScript + '\n' + body.slice(bodyCloseIndex);
                injected = true;
            }
            
            // Strategy 2: Before closing html tag
            if (!injected) {
                const htmlCloseIndex = body.lastIndexOf('</html>');
                if (htmlCloseIndex !== -1) {
                    body = body.slice(0, htmlCloseIndex) + hotReloadScript + '\n' + body.slice(htmlCloseIndex);
                    injected = true;
                }
            }
            
            // Strategy 3: Before the last closing div (for React fragments)
            if (!injected) {
                const lastDivIndex = body.lastIndexOf('</div>');
                if (lastDivIndex !== -1) {
                    body = body.slice(0, lastDivIndex + 6) + hotReloadScript + body.slice(lastDivIndex + 6);
                    injected = true;
                }
            }
            
            // Strategy 4: Append to end as fallback
            if (!injected) {
                body += hotReloadScript;
            }
            
            // Hot reload script injected
        }

        // Call original send method
        return originalSend.call(this, body);
    };

    next();
};

/**
 * Apply hot reload middleware to Express app
 */
export const applyHotReload = (app: Express): void => {
    if (!isDevelopment) {
        // Skipping hot reload middleware in production mode
        return;
    }

    // Applying hot reload injection middleware only
    // (static middleware is applied separately before Vite)
    app.use(hotReloadInjectionMiddleware);
};

/**
 * Clear cached hot reload script (useful for development)
 */
export const clearHotReloadCache = (): void => {
    hotReloadClientScript = null;
    // Hot reload script cache cleared
};

/**
 * Get hot reload middleware status
 */
export const getHotReloadStatus = (): HotReloadStatus => {
    return {
        enabled: isDevelopment,
        scriptLoaded: hotReloadClientScript !== null,
        scriptSize: hotReloadClientScript ? hotReloadClientScript.length : 0
    };
};
