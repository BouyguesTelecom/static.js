/**
 * WebSocket server utilities for hot reloading
 * Handles WebSocket connections and broadcasting reload messages
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { isDevelopment } from '../config/index.js';

interface ReloadMessage {
    type: 'reload';
    reloadType: string;
    timestamp: number;
    data: Record<string, any>;
}

interface ConnectedMessage {
    type: 'connected';
    message: string;
}

type WebSocketMessage = ReloadMessage | ConnectedMessage;

let wss: WebSocketServer | null = null;
let clients: Set<WebSocket> = new Set();

/**
 * Initialize WebSocket server attached to HTTP server
 */
export const initializeWebSocketServer = (httpServer: HttpServer): WebSocketServer | null => {
    if (!isDevelopment) {
        console.log('[WebSocket] Skipping WebSocket server initialization in production mode');
        return null;
    }

    try {
        // Create WebSocket server attached to HTTP server
        wss = new WebSocketServer({ 
            server: httpServer,
            path: '/ws'
        });

        wss.on('connection', (ws: WebSocket, req) => {
            console.log(`[WebSocket] Client connected from ${req.socket.remoteAddress}`);
            clients.add(ws);

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'Hot reload client connected'
            } as ConnectedMessage));

            // Handle client disconnect
            ws.on('close', () => {
                console.log('[WebSocket] Client disconnected');
                clients.delete(ws);
            });

            // Handle client errors
            ws.on('error', (error: Error) => {
                console.error('[WebSocket] Client error:', error);
                clients.delete(ws);
            });

            // Handle ping/pong for connection health
            ws.on('pong', () => {
                (ws as any).isAlive = true;
            });
        });

        // Setup ping interval to detect dead connections
        const pingInterval = setInterval(() => {
            if (wss && wss.clients) {
                wss.clients.forEach((ws: WebSocket) => {
                    if ((ws as any).isAlive === false) {
                        clients.delete(ws);
                        return ws.terminate();
                    }
                    
                    (ws as any).isAlive = false;
                    ws.ping();
                });
            }
        }, 30000); // 30 seconds

        wss.on('close', () => {
            clearInterval(pingInterval);
        });

        console.log('[WebSocket] WebSocket server initialized for hot reloading');
        return wss;
    } catch (error) {
        console.error('[WebSocket] Failed to initialize WebSocket server:', error);
        return null;
    }
};

/**
 * Broadcast reload message to all connected clients
 */
export const broadcastReload = (type: string = 'page', data: Record<string, any> = {}): void => {
    if (!isDevelopment) {
        return;
    }

    if (!wss) {
        console.warn('[WebSocket] WebSocket server not initialized, cannot broadcast reload');
        return;
    }

    const message: ReloadMessage = {
        type: 'reload',
        reloadType: type,
        timestamp: Date.now(),
        data
    };

    const messageString = JSON.stringify(message);
    let sentCount = 0;
    let deadConnections = 0;
    
    clients.forEach((ws: WebSocket) => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageString);
                sentCount++;
            } catch (error) {
                console.error('[WebSocket] Error sending message to client:', error);
                clients.delete(ws);
                deadConnections++;
            }
        } else {
            clients.delete(ws);
            deadConnections++;
        }
    });

    if (sentCount > 0) {
        console.log(`[WebSocket] Broadcasted ${type} reload to ${sentCount} client(s)`);
    } else if (clients.size === 0) {
        console.log('[WebSocket] No clients connected to broadcast reload message');
    }
    
    if (deadConnections > 0) {
        console.log(`[WebSocket] Cleaned up ${deadConnections} dead connection(s)`);
    }
};

/**
 * Get current WebSocket server instance
 */
export const getWebSocketServer = (): WebSocketServer | null => wss;

/**
 * Get number of connected clients
 */
export const getConnectedClientsCount = (): number => clients.size;

/**
 * Close WebSocket server and cleanup
 */
export const closeWebSocketServer = async (): Promise<void> => {
    if (!wss) {
        return;
    }

    return new Promise<void>((resolve) => {
        console.log('[WebSocket] Closing WebSocket server...');
        
        // Close all client connections
        clients.forEach((ws: WebSocket) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close(1000, 'Server shutting down');
            }
        });
        clients.clear();

        // Close the server
        wss!.close(() => {
            console.log('[WebSocket] WebSocket server closed');
            wss = null;
            resolve();
        });
    });
};