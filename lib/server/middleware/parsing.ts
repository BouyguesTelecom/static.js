/**
 * Request parsing middleware configuration
 * Handles JSON and URL-encoded body parsing
 */

import express, { Express } from "express";
import { CONFIG } from "../config/index.js";

/**
 * Apply parsing middleware to Express app
 */
export const applyParsing = (app: Express): void => {
    // JSON body parser with size limit
    app.use(express.json({
        limit: CONFIG.BODY_SIZE_LIMIT,
        type: 'application/json',
    }));

    // URL-encoded body parser with size limit
    app.use(express.urlencoded({
        extended: true,
        limit: CONFIG.BODY_SIZE_LIMIT,
    }));
};
