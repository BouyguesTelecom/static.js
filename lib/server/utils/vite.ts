/**
 * Vite server utilities
 * Handles Vite server initialization and JavaScript serving for development mode
 */

import { createServer as createViteServer, ViteDevServer } from "vite";
import { Express } from "express";
import { isDevelopment } from "../config/index.js";
import { registerJavaScriptMiddleware } from "../middleware/runtime.js";

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
            // Initializing Vite server
            
            // Create Vite server for development mode JS compilation
            viteServer = await createViteServer({
                server: {
                    middlewareMode: true,
                    hmr: {
                        port: 24679  // Use different port to avoid conflicts
                    }
                },
                appType: 'custom',
                configFile: '../../lib/server/config/vite.config.ts'
            });
            
            // Vite server initialized
            
            // Add Vite's middleware to handle dependency requests
            app.use(viteServer.middlewares);
            
            // Register JavaScript serving middleware after Vite server is ready
            registerJavaScriptMiddleware(app, viteServer);
        } catch (error) {
            console.error('❌ Failed to initialize Vite server:', error);
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
