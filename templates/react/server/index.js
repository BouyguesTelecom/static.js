/**
 * Main server entry point for StaticJS React template
 * Modular Express.js server with enhanced security, performance, and developer experience
 */

import express from "express";

// Import configuration
import { CONFIG } from "./config/index.js";

// Import middleware modules
import { applySecurity } from "./middleware/security.js";
import { applyPerformance } from "./middleware/performance.js";
import { applyRateLimiting } from "./middleware/rateLimiting.js";
import { applyParsing } from "./middleware/parsing.js";
import { applyLogging } from "./middleware/logging.js";
import { applyRuntime } from "./middleware/runtime.js";
import { applyStatic } from "./middleware/static.js";
import { applyErrorHandling } from "./middleware/errorHandling.js";

// Import route handlers
import { registerApiRoutes } from "./routes/api.js";

// Import utilities
import { initializeViteServer } from "./utils/vite.js";
import { startServer, setupProcessHandlers } from "./utils/startup.js";

/**
 * Create and configure Express application
 */
const createApp = () => {
    const app = express();

    // Apply middleware in the correct order
    applySecurity(app);
    applyPerformance(app);
    applyRateLimiting(app);
    applyParsing(app);
    applyLogging(app);
    
    // Runtime rendering middleware (development mode only)
    applyRuntime(app);
    
    // Static file serving
    applyStatic(app);
    
    // API routes
    registerApiRoutes(app);
    
    // Error handling (must be last)
    applyErrorHandling(app);

    return app;
};

/**
 * Initialize and start the server
 */
const main = async () => {
    try {
        // Create Express app
        const app = createApp();
        
        // Start server with Vite initialization
        const server = await startServer(app, initializeViteServer);
        
        // Setup graceful shutdown handlers
        setupProcessHandlers(server);
        
        return app;
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
const app = await main();

export default app;