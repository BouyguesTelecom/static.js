/**
 * Server startup and shutdown utilities
 * Handles server initialization and graceful shutdown
 */

import { CONFIG } from "../config/index.js";
import { closeViteServer, getViteServer } from "./vite.js";

/**
 * Start the server with proper error handling
 */
export const startServer = async (app, initializeViteServer) => {
    // Initialize Vite server first
    await initializeViteServer(app);

    return app.listen(CONFIG.PORT, () => {
        const viteServer = getViteServer();
        console.log(`
🚀 StaticJS Server Started
=====================================
Environment: ${CONFIG.NODE_ENV}
Port: ${CONFIG.PORT}
URL: http://localhost:${CONFIG.PORT}
Health Check: http://localhost:${CONFIG.PORT}/health
Pages API: http://localhost:${CONFIG.PORT}/api/pages
${viteServer ? 'Vite JS Compilation: ✅ Enabled' : 'Vite JS Compilation: ❌ Disabled'}
=====================================
      `);
    });
};

/**
 * Graceful shutdown handling
 */
export const gracefulShutdown = async (server, signal) => {
    console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);

    // Close Vite server if it exists
    await closeViteServer();

    server.close((err) => {
        if (err) {
            console.error('❌ Error during server shutdown:', err);
            process.exit(1);
        }

        console.log('✅ Server closed successfully');
        process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

/**
 * Setup process event handlers for graceful shutdown
 */
export const setupProcessHandlers = (server) => {
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('💥 Uncaught Exception:', err);
        gracefulShutdown(server, 'uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        gracefulShutdown(server, 'unhandledRejection');
    });
};