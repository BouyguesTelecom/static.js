/**
 * Modern Express.js server for StaticJS React template
 * Enhanced with security, performance, and developer experience improvements
 */

import { revalidate } from "@bouygues-telecom/staticjs/dist/scripts/revalidate.js";
import express from "express";
import { readdir } from "fs/promises";
import { join, extname } from "path";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

const CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  STATIC_DIR: 'dist',
  REQUEST_TIMEOUT: 30000, // 30 seconds
  BODY_SIZE_LIMIT: '10mb',
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100, // requests per window
  REVALIDATE_RATE_LIMIT_MAX: 10, // stricter limit for revalidate endpoint
  CACHE_MAX_AGE: process.env.NODE_ENV === 'production' ? 86400 : 0, // 1 day in prod, no cache in dev
};

const isDevelopment = CONFIG.NODE_ENV === 'development';
const isProduction = CONFIG.NODE_ENV === 'production';

// =============================================================================
// EXPRESS APP INITIALIZATION
// =============================================================================

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

/**
 * Security headers middleware using helmet
 * Configures appropriate security headers for the application
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
}));

/**
 * CORS configuration for development
 * Allows cross-origin requests in development mode
 */
if (isDevelopment) {
  app.use(cors({
    origin: true,
    credentials: true,
  }));
}

// =============================================================================
// PERFORMANCE MIDDLEWARE
// =============================================================================

/**
 * Compression middleware for response optimization
 */
app.use(compression());

/**
 * Request timeout middleware
 */
app.use((req, res, next) => {
  req.setTimeout(CONFIG.REQUEST_TIMEOUT, () => {
    const err = new Error('Request timeout');
    err.status = 408;
    next(err);
  });
  next();
});

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * General rate limiting for all endpoints
 */
const generalLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW,
  max: CONFIG.RATE_LIMIT_MAX,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(CONFIG.RATE_LIMIT_WINDOW / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter rate limiting for revalidate endpoint
 */
const revalidateLimiter = rateLimit({
  windowMs: CONFIG.RATE_LIMIT_WINDOW,
  max: CONFIG.REVALIDATE_RATE_LIMIT_MAX,
  message: {
    error: 'Too many revalidate requests, please try again later.',
    retryAfter: Math.ceil(CONFIG.RATE_LIMIT_WINDOW / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// =============================================================================
// REQUEST PARSING MIDDLEWARE
// =============================================================================

/**
 * JSON body parser with size limit
 */
app.use(express.json({ 
  limit: CONFIG.BODY_SIZE_LIMIT,
  type: 'application/json',
}));

/**
 * URL-encoded body parser with size limit
 */
app.use(express.urlencoded({ 
  extended: true, 
  limit: CONFIG.BODY_SIZE_LIMIT,
}));

// =============================================================================
// LOGGING MIDDLEWARE
// =============================================================================

/**
 * Request logging middleware with timestamps and details
 */
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('User-Agent') || 'Unknown';
  const ip = req.ip || req.connection.remoteAddress || 'Unknown';
  
  console.log(`[${timestamp}] ${req.method} ${req.url} - IP: ${ip} - User-Agent: ${userAgent.substring(0, 100)}`);
  
  // Log response time
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// =============================================================================
// STATIC FILE SERVING
// =============================================================================

/**
 * Enhanced static file serving with proper cache headers
 */
app.use(express.static(CONFIG.STATIC_DIR, {
  maxAge: CONFIG.CACHE_MAX_AGE * 1000, // Convert to milliseconds
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Set cache headers based on file type
    const ext = extname(path).toLowerCase();
    
    if (['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
      // Cache static assets for longer
      res.setHeader('Cache-Control', `public, max-age=${CONFIG.CACHE_MAX_AGE}`);
    } else if (['.html', '.htm'].includes(ext)) {
      // Don't cache HTML files in development
      res.setHeader('Cache-Control', isDevelopment ? 'no-cache' : `public, max-age=${CONFIG.CACHE_MAX_AGE / 24}`);
    }
    
    // Security headers for static files
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// =============================================================================
// API ENDPOINTS
// =============================================================================

/**
 * Health check endpoint
 * Returns server status and basic information
 */
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: CONFIG.NODE_ENV,
    version: process.version,
    memory: process.memoryUsage(),
  };
  
  res.status(200).json(healthInfo);
});

/**
 * API endpoint to list available pages
 * Scans the static directory for HTML files
 */
app.get('/api/pages', async (req, res) => {
  try {
    const pages = await getAvailablePages();
    res.status(200).json({
      success: true,
      pages,
      count: pages.length,
    });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list available pages',
      message: isDevelopment ? error.message : 'Internal server error',
    });
  }
});

/**
 * Revalidate endpoint with enhanced error handling and rate limiting
 */
app.post('/revalidate', revalidateLimiter, async (req, res) => {
  try {
    await revalidate(req, res);
  } catch (error) {
    console.error('Revalidate error:', error);
    res.status(500).json({
      success: false,
      error: 'Revalidation failed',
      message: isDevelopment ? error.message : 'Internal server error',
    });
  }
});

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

/**
 * 404 handler for unmatched routes
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Global error handling middleware
 */
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  const status = err.status || err.statusCode || 500;
  
  // Log error details
  console.error(`[${timestamp}] Error ${status}:`, {
    message: err.message,
    stack: isDevelopment ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });
  
  // Send error response
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal Server Error' : err.message,
    message: isDevelopment ? err.message : 'An error occurred',
    timestamp,
    ...(isDevelopment && { stack: err.stack }),
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Scans the static directory for available HTML pages
 * @returns {Promise<Array>} Array of available page paths
 */
async function getAvailablePages() {
  const pages = [];
  
  try {
    const scanDirectory = async (dir, basePath = '') => {
      const items = await readdir(join(CONFIG.STATIC_DIR, dir), { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = join(dir, item.name);
        const urlPath = join(basePath, item.name);
        
        if (item.isDirectory()) {
          await scanDirectory(itemPath, urlPath);
        } else if (item.isFile() && extname(item.name).toLowerCase() === '.html') {
          const pagePath = urlPath.replace(/\.html$/, '').replace(/\\/g, '/');
          pages.push({
            name: item.name,
            path: pagePath === 'index' ? '/' : `/${pagePath}`,
            file: itemPath.replace(/\\/g, '/'),
          });
        }
      }
    };
    
    await scanDirectory('');
  } catch (error) {
    console.warn('Could not scan pages directory:', error.message);
  }
  
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

// =============================================================================
// SERVER STARTUP AND GRACEFUL SHUTDOWN
// =============================================================================

/**
 * Start the server with proper error handling
 */
const server = app.listen(CONFIG.PORT, () => {
  console.log(`
🚀 StaticJS Server Started
=====================================
Environment: ${CONFIG.NODE_ENV}
Port: ${CONFIG.PORT}
URL: http://localhost:${CONFIG.PORT}
Health Check: http://localhost:${CONFIG.PORT}/health
Pages API: http://localhost:${CONFIG.PORT}/api/pages
=====================================
  `);
});

/**
 * Graceful shutdown handling
 */
const gracefulShutdown = (signal) => {
  console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
  
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

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

export default app;
