import { spawn } from "child_process";
import { Request, Response } from "express";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";
import { isDevelopment } from "../config/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Validation des chemins autorisés
const validatePath = (inputPath: string): boolean => {
  // Autoriser seulement les chemins alphanumériques avec / - _ .
  const pathRegex = /^[a-zA-Z0-9\/_.-]*$/;
  
  // Vérifier le format
  if (!pathRegex.test(inputPath)) {
    return false;
  }
  
  // Interdire les séquences dangereuses
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

// Authentification basique pour l'endpoint revalidate
const validateRevalidateAuth = (req: Request): boolean => {
  const authToken = req.headers['x-revalidate-token'] as string;
  const expectedToken = process.env.REVALIDATE_TOKEN;
  
  // En développement, permettre sans token si pas configuré
  if (isDevelopment && !expectedToken) {
    console.warn('[Security] Revalidate endpoint accessible sans authentification en mode développement');
    return true;
  }
  
  // En production, exiger un token
  if (!expectedToken) {
    console.error('[Security] REVALIDATE_TOKEN non configuré en production');
    return false;
  }
  
  return authToken === expectedToken;
};

export const revalidate = (req: Request, res: Response): void | Response => {
  try {
    // Vérification de l'authentification
    if (!validateRevalidateAuth(req)) {
      console.warn(`[Security] Tentative d'accès non autorisée à /revalidate depuis ${req.ip}`);
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Token d\'authentification requis'
      });
      return;
    }

    const paths = req?.body?.paths || [];
    
    // Validation stricte des chemins
    if (!Array.isArray(paths)) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Le paramètre paths doit être un tableau'
      });
      return;
    }
    
    // Valider chaque chemin individuellement
    const validatedPaths: string[] = [];
    for (const inputPath of paths) {
      if (typeof inputPath !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Tous les chemins doivent être des chaînes de caractères'
        });
        return;
      }
      
      if (!validatePath(inputPath)) {
        console.warn(`[Security] Chemin invalide détecté: ${inputPath}`);
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Chemin invalide: ${inputPath}`
        });
        return;
      }
      
      validatedPaths.push(inputPath);
    }

    const cachePages = path.resolve(__dirname, "../../../helpers/cachePages.js");
    const buildHtmlConfig = path.resolve(__dirname, "../../../scripts/build-html.js");
    const cacheArgs = validatedPaths.length > 0 ? validatedPaths : [];
    const cacheProcess = spawn('node', [cachePages, ...cacheArgs], {
      stdio: 'pipe',
      env: {
        ...process.env
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
          message: 'Échec de la mise en cache'
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
            message: 'Échec de la construction'
          });
          return;
        }

        console.log(`[Revalidate] Success: ${cacheOutput} ${buildOutput}`);
        
        res.status(200).json({
          success: true,
          message: `Revalidation réussie, chemins: ${
            validatedPaths.length > 0 ? validatedPaths.join(", ") : "toutes les pages"
          }`,
          paths: validatedPaths
        });
      });

      buildProcess.on('error', (error) => {
        console.error(`[Revalidate] Build process error: ${error}`);
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Erreur lors de la construction'
        });
      });
    });

    cacheProcess.on('error', (error) => {
      console.error(`[Revalidate] Cache process error: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erreur lors de la mise en cache'
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