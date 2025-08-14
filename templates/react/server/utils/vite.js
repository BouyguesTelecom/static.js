/**
 * Vite server utilities
 * Handles Vite server initialization and JavaScript serving for development mode
 */

import { createServer as createViteServer } from "vite";
import { isDevelopment } from "../config/index.js";
import { registerJavaScriptMiddleware } from "../middleware/runtime.js";

let viteServer = null;

/**
 * Initialize Vite server for development mode
 */
export const initializeViteServer = async (app) => {
    if (isDevelopment) {
        try {
            // Create Vite server for development mode JS compilation
            viteServer = await createViteServer({
                server: { middlewareMode: true },
                appType: 'custom',
                configFile: './vite.config.js'
            });
            console.log('✅ Vite server initialized for JS compilation');
            
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
export const getViteServer = () => viteServer;

/**
 * Close the Vite server
 */
export const closeViteServer = async () => {
    if (viteServer) {
        try {
            await viteServer.close();
            console.log('✅ Vite server closed successfully');
        } catch (error) {
            console.error('❌ Error closing Vite server:', error);
        }
    }
};