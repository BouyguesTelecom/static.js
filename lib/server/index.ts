/**
 * Main server entry point for StaticJS React template
 * Modular Express.js server with enhanced security, performance, and developer experience
 */

import express, {Express} from "express";
import {Server} from "http";

// Import configuration
import {CONFIG, isDevelopment} from "./config/index.js";

// Import middleware modules
import {applySecurity} from "./middleware/security.js";
import {applyPerformance} from "./middleware/performance.js";
import {applyRateLimiting} from "./middleware/rateLimiting.js";
import {applyParsing} from "./middleware/parsing.js";
import {applyLogging} from "./middleware/logging.js";
import {applyRuntime} from "./middleware/runtime.js";
import {applyHotReload} from "./middleware/hotReload.js";
import {applyStatic} from "./middleware/static.js";
import {applyErrorHandling} from "./middleware/errorHandling.js";

// Import route handlers
import {registerApiRoutes} from "./routes/api.js";

// Import utilities
import {initializeViteServer} from "./utils/vite.js";
import {setupProcessHandlers, startServer} from "./utils/startup.js";
import {initializeWebSocketServer} from "./utils/websocket.js";
import {initializeFileWatcher} from "./utils/fileWatcher.js";

// Singleton pattern to prevent duplicate server initialization
let serverInstance: Express | null = null;
let isServerStarting = false;

/**
 * Create and configure Express application
 * @returns Promise<Express> - Configured Express application
 */
export const createApp = async (): Promise<Express> => {
    // Creating Express application
    const app = express();

    // Apply middleware in the correct order
    // Applying middleware
    applySecurity(app);
    applyPerformance(app);
    applyRateLimiting(app);
    applyParsing(app);
    applyLogging(app);

    // Hot reload static middleware MUST be applied before Vite to ensure proper serving
    if (isDevelopment) {
        const { hotReloadStaticMiddleware } = await import('./middleware/hotReload.js');
        app.use(hotReloadStaticMiddleware);
    }

    // Initialize Vite server and register JavaScript routes BEFORE runtime middleware
    if (isDevelopment) {
        await initializeViteServer(app);
    }

    // Hot reload injection middleware (development mode only) - MUST be before runtime
    applyHotReload(app);

    // Runtime rendering middleware (development mode only)
    // JavaScript routes are now registered before this middleware
    applyRuntime(app);

    // Static file serving - comes after runtime to avoid interfering with JS serving
    applyStatic(app);

    // API routes
    registerApiRoutes(app);

    // Error handling (must be last)
    applyErrorHandling(app);

    return app;
};

/**
 * Initialize and start the server
 * @returns Promise<Express> - Running Express application
 */
export const startStaticJSServer = async (): Promise<Express> => {
    // Starting StaticJS server

    // Prevent duplicate initialization
    if (serverInstance) {
        // Server already running
        return serverInstance;
    }

    if (isServerStarting) {
        // Server is already starting, waiting
        // Wait for the other initialization to complete
        while (isServerStarting && !serverInstance) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return serverInstance!;
    }

    isServerStarting = true;

    try {
        // Create Express app
        const app = await createApp();
        serverInstance = app;

        // Start server (Vite is already initialized in createApp)
        const server: Server = await startServer(app);

        // Initialize WebSocket server for hot reloading FIRST (development only)
        if (CONFIG.WEBSOCKET_ENABLED && CONFIG.FILE_WATCHING_ENABLED) {
            const wsServer = initializeWebSocketServer(server);
            console.log('[Server] WebSocket server initialized');

            // Wait a moment to ensure WebSocket server is fully ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Initialize file watcher AFTER WebSocket server (development only)
            const fileWatcher = initializeFileWatcher();
            console.log('[Server] File watcher initialized');
        }

        // Setup graceful shutdown handlers
        setupProcessHandlers(server);

        isServerStarting = false;
        return app;
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        isServerStarting = false;
        serverInstance = null;
        process.exit(1);
    }
};

// Export additional utilities for external use
export {CONFIG, isDevelopment} from "./config/index.js";
export type {ServerConfig} from "./config/index.js";
export {initializeViteServer} from "./utils/vite.js";
export {setupProcessHandlers, startServer} from "./utils/startup.js";

// Only start the server when this module is run directly (not when imported)
let app: Express | undefined;

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('[Server] Module executed directly, starting server...');
    app = await startStaticJSServer();
} else {
    console.log('[Server] Module imported, not starting server automatically');
}

// Default export is the app creation function
export default app;

// Named export for the main function (for backwards compatibility)
export const main = startStaticJSServer;
