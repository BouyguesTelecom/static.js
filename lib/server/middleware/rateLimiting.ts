/**
 * Rate limiting middleware configuration
 * Handles general and specific rate limiting for different endpoints
 */

import rateLimit from "express-rate-limit";
import { Express } from "express";
import { CONFIG } from "../config/index.js";

/**
 * General rate limiting for all endpoints
 */
export const generalLimiter = rateLimit({
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
export const revalidateLimiter = rateLimit({
    windowMs: CONFIG.RATE_LIMIT_WINDOW,
    max: CONFIG.REVALIDATE_RATE_LIMIT_MAX,
    message: {
        error: 'Too many revalidate requests, please try again later.',
        retryAfter: Math.ceil(CONFIG.RATE_LIMIT_WINDOW / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Apply rate limiting middleware to Express app
 */
export const applyRateLimiting = (app: Express): void => {
    app.use(generalLimiter);
};
