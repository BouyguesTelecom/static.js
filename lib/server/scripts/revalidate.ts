import { execFile } from "child_process";
import { Request, Response } from "express";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Maximum allowed path length to prevent buffer overflow attacks
 */
const MAX_PATH_LENGTH = 256;

/**
 * Normalize a path by stripping leading/trailing slashes.
 * Consumers typically send URL paths like "/guide-pratique" but
 * we expect bare page names like "guide-pratique".
 */
const normalizePath = (p: string): string => p.replace(/^\/+|\/+$/g, "");

/**
 * Strict path validation:
 * - Must be a string
 * - Must match safe characters only (alphanumeric, underscore, hyphen, slash)
 * - Each segment between slashes must be non-empty and alphanumeric/underscore/hyphen
 * - Must not exceed max length
 */
const isValidPath = (p: unknown): p is string => {
  if (typeof p !== "string") return false;
  const normalized = normalizePath(p);
  if (normalized.length === 0 || normalized.length > MAX_PATH_LENGTH) return false;
  // Allow path segments separated by single slashes
  if (!/^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/.test(normalized)) return false;
  return true;
};

/**
 * Validate that a path resolves to a page within the pages directory.
 * Supports dynamic routes: segments that don't match a literal directory
 * are matched against [param] directories.
 */
const isPathWithinPagesDir = (pageName: string, projectRoot: string): boolean => {
  const pagesDir = path.resolve(projectRoot, 'src/pages');
  const segments = pageName.split('/');
  let currentDir = pagesDir;

  try {
    for (const segment of segments) {
      const exactPath = path.join(currentDir, segment);
      if (fs.existsSync(exactPath) && fs.statSync(exactPath).isDirectory()) {
        currentDir = exactPath;
        continue;
      }

      // Look for a dynamic [param] directory
      const entries = fs.readdirSync(currentDir);
      const dynamicDir = entries.find(
        (e) => /^\[.+\]$/.test(e) && fs.statSync(path.join(currentDir, e)).isDirectory()
      );
      if (dynamicDir) {
        currentDir = path.join(currentDir, dynamicDir);
        continue;
      }

      return false;
    }

    // Ensure we stayed within pagesDir
    return currentDir.startsWith(pagesDir + path.sep);
  } catch {
    return false;
  }
};

/**
 * Get safe environment variables for child processes
 * Only passes necessary, non-sensitive variables
 */
const getSafeEnv = (): NodeJS.ProcessEnv => {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: process.env.NODE_ENV,
    // Add other safe variables as needed
  };
};

export const revalidate = (req: Request, res: Response): void => {
  try {
    const rawPaths = req?.body?.paths;
    const projectRoot = process.cwd();

    // Normalize and validate paths
    const normalizedPaths: string[] = Array.isArray(rawPaths)
      ? rawPaths
          .filter(isValidPath)
          .map((p: string) => normalizePath(p))
      : [];

    const paths = normalizedPaths.filter((p: string) => isPathWithinPagesDir(p, projectRoot));

    // Log any rejected paths for security monitoring
    if (Array.isArray(rawPaths)) {
      const rejectedPaths = rawPaths.filter((p: unknown) => !isValidPath(p));
      if (rejectedPaths.length > 0) {
        console.warn('[Security] Rejected invalid revalidation paths:', rejectedPaths);
      }
    }

    const cachePages = path.resolve(__dirname, "../../helpers/cachePages.mjs");
    const buildHtmlConfig = path.resolve(__dirname, "../../scripts/build-html.mjs");

    execFile(
      "node",
      [cachePages, ...paths],
      { env: getSafeEnv() },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Cache pages error: ${error}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        if (stderr) console.error(`stderr: ${stderr}`);

        execFile("npx", ["tsx", buildHtmlConfig], { env: getSafeEnv() }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Build HTML error: ${error}`);
            return;
          }
          console.log(`stdout: ${stdout}`);
          if (stderr) console.error(`stderr: ${stderr}`);
        });
      }
    );

    res
      .status(200)
      .send(
        `Revalidation triggered, paths: ${
          paths.length > 0 ? paths.join(", ") : "all pages"
        } built!`
      );
  } catch (error) {
    console.error("Revalidation error:", error);
    res.status(500).send("Error during revalidation.");
  }
};
