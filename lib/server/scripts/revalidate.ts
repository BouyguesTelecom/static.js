import { spawn } from "child_process";
import { Request, Response } from "express";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";
import { isDevelopment, CONFIG } from "../config/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Validate allowed paths
const validatePath = (inputPath: string): boolean => {
  // Allow only alphanumeric paths with / - _ .
  const pathRegex = /^[a-zA-Z0-9\/_.-]*$/;
  
  // Check format
  if (!pathRegex.test(inputPath)) {
    return false;
  }
  
  // Block dangerous patterns
  const dangerousPatterns = [
    '..',     // Directory traversal
    ';',      // Command injection
    '&',      // Command chaining
    '|',      // Pipe
    '$',      // Variable expansion
    '`',      // Command substitution
    '(',      // Subshell
    ')',      // Subshell
    '{',      // Brace expansion
    '}',      // Brace expansion
    '*',      // Wildcard
    '?',      // Wildcard
    '[',      // Character class
    ']',      // Character class
    '\\',     // Escape character
    '\n',     // Newline
    '\r',     // Carriage return
  ];
  
  return !dangerousPatterns.some(pattern => inputPath.includes(pattern));
};

// Basic authentication for revalidate endpoint
const validateRevalidateAuth = (req: Request): boolean => {
  const authToken = req.headers['x-revalidate-token'] as string;
  const expectedToken = CONFIG.REVALIDATE_TOKEN;
  
  // In development, allow without token if not configured
  if (isDevelopment && !expectedToken) {
    console.warn('[Security] Revalidate endpoint accessible without authentication in development mode');
    return true;
  }
  
  // In production, require a token
  if (!expectedToken) {
    console.error('[Security] REVALIDATE_TOKEN not configured in production');
    return false;
  }
  
  return authToken === expectedToken;
};

export const revalidate = (req: Request, res: Response): void | Response => {
  try {
    // Authentication verification
    if (!validateRevalidateAuth(req)) {
      console.warn(`[Security] Unauthorized access attempt to /revalidate from ${req.ip}`);
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication token required'
      });
      return;
    }

    const paths = req?.body?.paths || [];
    
    // Strict path validation
    if (!Array.isArray(paths)) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'The paths parameter must be an array'
      });
      return;
    }
    
    // Validate each path individually
    const validatedPaths: string[] = [];
    for (const inputPath of paths) {
      if (typeof inputPath !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'All paths must be strings'
        });
        return;
      }
      
      if (!validatePath(inputPath)) {
        console.warn(`[Security] Invalid path detected: ${inputPath}`);
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Invalid path: ${inputPath}`
        });
        return;
      }
      
      validatedPaths.push(inputPath);
    }

    const cachePages = path.resolve(__dirname, "../../helpers/cachePages.js");
    const buildHtmlConfig = path.resolve(__dirname, "../../scripts/build-html.js");
    
    // Use spawn instead of exec to prevent command injection
    // First command: cachePages
    const cacheArgs = validatedPaths.length > 0 ? validatedPaths : [];
    const cacheProcess = spawn('node', [cachePages, ...cacheArgs], {
      stdio: 'pipe',
      env: {
        ...process.env
        // Removed dangerous TLS bypass: NODE_TLS_REJECT_UNAUTHORIZED: '0'
      }
    });

    let cacheOutput = '';
    let cacheError = '';

    cacheProcess.stdout.on('data', (data) => {
      cacheOutput += data.toString();
    });

    cacheProcess.stderr.on('data', (data) => {
      cacheError += data.toString();
    });

    cacheProcess.on('close', (cacheCode) => {
      if (cacheCode !== 0) {
        console.error(`[Revalidate] Cache process failed with code ${cacheCode}: ${cacheError}`);
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Cache process failed'
        });
        return;
      }

      const buildProcess = spawn('npx', ['tsx', buildHtmlConfig], {
        stdio: 'pipe',
        env: process.env
      });

      let buildOutput = '';
      let buildError = '';

      buildProcess.stdout.on('data', (data) => {
        buildOutput += data.toString();
      });

      buildProcess.stderr.on('data', (data) => {
        buildError += data.toString();
      });

      buildProcess.on('close', (buildCode) => {
        if (buildCode !== 0) {
          console.error(`[Revalidate] Build process failed with code ${buildCode}: ${buildError}`);
          res.status(500).json({
            success: false,
            error: 'Internal Server Error',
            message: 'Build process failed'
          });
          return;
        }

        console.log(`[Revalidate] Success: ${cacheOutput} ${buildOutput}`);
        
        res.status(200).json({
          success: true,
          message: `Revalidation successful, paths: ${
            validatedPaths.length > 0 ? validatedPaths.join(", ") : "all pages"
          }`,
          paths: validatedPaths
        });
      });

      buildProcess.on('error', (error) => {
        console.error(`[Revalidate] Build process error: ${error}`);
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Build process error'
        });
      });
    });

    cacheProcess.on('error', (error) => {
      console.error(`[Revalidate] Cache process error: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Cache process error'
      });
    });

  } catch (error) {
    console.error("[Revalidate] Unexpected error:", error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Revalidate error'
    });
  }
};