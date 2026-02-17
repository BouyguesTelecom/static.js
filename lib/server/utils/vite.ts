/**
 * Vite server utilities
 * Handles Vite server initialization and JavaScript serving for development mode
 */

import { createServer as createViteServer, ViteDevServer } from "vite";
import { Express } from "express";
import { isDevelopment, CONFIG } from "../config/index.js";
import { registerJavaScriptMiddleware, registerCSSMiddleware } from "../middleware/runtime.js";
import { loadCacheEntries } from "../../helpers/cachePages.js";
import { addHydrationCodePlugin } from "../config/vite.plugin.js";
import path from "path";

let viteServer: ViteDevServer | null = null;

/**
 * Initialize Vite server for development mode
 */
export const initializeViteServer = async (app: Express): Promise<ViteDevServer | null> => {
    if (isDevelopment) {
        // Check if Vite server is already initialized
        if (viteServer) {
            // Vite server already initialized
            return viteServer;
        }

        try {
            // Load cache entries for build input
            const entries = loadCacheEntries(CONFIG.PROJECT_ROOT);

            // Sanitize entry keys for Rollup: strip dynamic segments [param]
            const sanitizedEntries: Record<string, string> = Object.fromEntries(
                Object.entries(entries as Record<string, string>).map(([key, value]) => [
                    key.replace(/\[([^\]]+)\]/g, '$1'),
                    value
                ])
            );

            // Create Vite server for development mode JS compilation
            // Using inline config to avoid path resolution issues when installed as a dependency
            viteServer = await createViteServer({
                server: {
                    middlewareMode: true,
                    hmr: {
                        port: 24679  // Use different port to avoid conflicts
                    }
                },
                appType: 'custom',
                configFile: false, // Don't load external config file
                resolve: {
                    alias: {
                        "@": path.resolve(CONFIG.PROJECT_ROOT, "src")
                    },
                },
                css: {
                    devSourcemap: true,
                    preprocessorOptions: {
                        scss: {
                            api: "modern-compiler",
                            loadPaths: [path.resolve(CONFIG.PROJECT_ROOT, "src")],
                        },
                    },
                },
                build: {
                    outDir: path.resolve(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR),
                    emptyOutDir: false,
                    rollupOptions: {
                        input: sanitizedEntries,
                        output: {
                            entryFileNames: "[name].js",
                            chunkFileNames: "assets/vendor-[hash].js",
                        },
                    },
                },
                plugins: [addHydrationCodePlugin(entries)],
            });
            
            // Vite server initialized
            
            // Add Vite's middleware to handle dependency requests
            app.use(viteServer.middlewares);
            
            // Register JavaScript serving middleware after Vite server is ready
            registerJavaScriptMiddleware(app, viteServer);

            // Register CSS serving middleware after Vite server is ready
            registerCSSMiddleware(app, viteServer);
        } catch (error) {
            console.error('❌ Failed to initialize Vite server:', error);
            
            // Check for common Node.js version compatibility issues
            if (error instanceof TypeError && error.message.includes('crypto.hash is not a function')) {
                console.error('');
                console.error('🔧 This error is likely due to a Node.js version compatibility issue.');
                console.error('   The crypto.hash() method requires Node.js 15.0.0 or higher.');
                console.error('   Current Node.js version:', process.version);
                console.error('');
                console.error('💡 Solutions:');
                console.error('   1. Update Node.js to version 18+ (recommended)');
                console.error('   2. Use a compatible Vite version (5.x instead of 6.x)');
                console.error('   3. Check your package.json engines field');
                console.error('');
            }
        }
    }
    
    return viteServer;
};

/**
 * Get the current Vite server instance
 */
export const getViteServer = (): ViteDevServer | null => viteServer;

/**
 * Close the Vite server
 */
export const closeViteServer = async (): Promise<void> => {
    if (viteServer) {
        try {
            await viteServer.close();
            // Vite server closed
        } catch (error) {
            console.error('❌ Error closing Vite server:', error);
        }
    }
};
