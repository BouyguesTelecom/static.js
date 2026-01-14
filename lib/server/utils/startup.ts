/**
 * Server startup and shutdown utilities
 * Handles server initialization and graceful shutdown
 */

import { Server } from 'http';
import { Express } from 'express';
import { CONFIG } from "../config/index.js";
import { closeViteServer, getViteServer } from "./vite.js";
import { closeWebSocketServer, getConnectedClientsCount } from "./websocket.js";
import { closeFileWatcher, getWatchedFilesCount } from "./fileWatcher.js";

/**
 * Start the server with proper error handling
 */
export const startServer = async (
    app: Express, 
    initializeViteServer?: (app: Express) => Promise<any>
): Promise<Server> => {
    // Initialize Vite server first (if provided)
    if (initializeViteServer) {
        await initializeViteServer(app);
    }

    return app.listen(CONFIG.PORT, CONFIG.HOST, () => {
        const viteServer = getViteServer();
        const wsClients = getConnectedClientsCount();
        const watchedFiles = getWatchedFilesCount();
        
        console.log(`
🚀 StaticJS Server Started
=====================================
Environment: ${CONFIG.NODE_ENV}
Port: ${CONFIG.PORT}
Host: ${CONFIG.HOST} ${CONFIG.HOST === '127.0.0.1' ? '🔒 (sécurised - localhost)' : '⚠️  (accessible externally)'}
URL: http://${CONFIG.HOST}:${CONFIG.PORT}
Health Check: http://${CONFIG.HOST}:${CONFIG.PORT}/health
Pages API: http://${CONFIG.HOST}:${CONFIG.PORT}/api/pages
${viteServer ? 'Vite JS Compilation: ✅ Enabled' : 'Vite JS Compilation: ❌ Disabled'}
${CONFIG.WEBSOCKET_ENABLED ? `WebSocket Hot Reload: ✅ Enabled (${wsClients} clients)` : 'WebSocket Hot Reload: ❌ Disabled'}
${CONFIG.FILE_WATCHING_ENABLED ? `File Watching: ✅ Enabled (${watchedFiles} files)` : 'File Watching: ❌ Disabled'}
${CONFIG.REVALIDATE_TOKEN ? 'Revalidate Security: ✅ Token configured' : 'Revalidate Security: ⚠️  No token (dev only)'}
=====================================
      `);
    });
};

/**
 * Graceful shutdown handling
 */
export const gracefulShutdown = async (server: Server, signal: string): Promise<void> => {
    console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);

    try {
        // Close file watcher first
        if (CONFIG.FILE_WATCHING_ENABLED) {
            console.log('🔍 Closing file watcher...');
            await closeFileWatcher();
        }

        // Close WebSocket server
        if (CONFIG.WEBSOCKET_ENABLED) {
            console.log('🔌 Closing WebSocket server...');
            await closeWebSocketServer();
        }

        // Close Vite server if it exists
        console.log('⚡ Closing Vite server...');
        await closeViteServer();

        // Close HTTP server
        console.log('🌐 Closing HTTP server...');
        server.close((err?: Error) => {
            if (err) {
                console.error('❌ Error during server shutdown:', err);
                process.exit(1);
            }

            console.log('✅ Server closed successfully');
            process.exit(0);
        });
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
    }

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('⚠️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

/**
 * Setup process event handlers for graceful shutdown
 */
export const setupProcessHandlers = (server: Server): void => {
    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown(server, 'SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err: Error) => {
        console.error('💥 Uncaught Exception:', err);
        gracefulShutdown(server, 'uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        gracefulShutdown(server, 'unhandledRejection');
    });
};