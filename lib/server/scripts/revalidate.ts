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
 * Strict path validation:
 * - Must be a string
 * - Must match safe characters only (alphanumeric, underscore, hyphen)
 * - No slashes allowed (paths are relative page names, not file paths)
 * - Must not be empty
 * - Must not exceed max length
 */
const isValidPath = (p: unknown): p is string => {
  if (typeof p !== "string") return false;
  if (p.length === 0 || p.length > MAX_PATH_LENGTH) return false;
  // Only allow alphanumeric, underscores, and hyphens - NO slashes
  if (!/^[a-zA-Z0-9_-]+$/.test(p)) return false;
  return true;
};

/**
 * Validate that a path resolves within the expected pages directory
 */
const isPathWithinPagesDir = (pageName: string, projectRoot: string): boolean => {
  const pagesDir = path.resolve(projectRoot, 'src/pages');
  const resolvedPath = path.resolve(pagesDir, pageName);

  // Ensure the resolved path starts with the pages directory
  if (!resolvedPath.startsWith(pagesDir + path.sep)) {
    return false;
  }

  // Verify the page directory actually exists
  try {
    return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory();
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

    // Validate and filter paths
    const paths: string[] = Array.isArray(rawPaths)
      ? rawPaths
          .filter(isValidPath)
          .filter((p: string) => isPathWithinPagesDir(p, projectRoot))
      : [];

    // Log any rejected paths for security monitoring
    if (Array.isArray(rawPaths)) {
      const rejectedPaths = rawPaths.filter(
        (p: unknown) => !isValidPath(p) || (typeof p === 'string' && !isPathWithinPagesDir(p, projectRoot))
      );
      if (rejectedPaths.length > 0) {
        console.warn('[Security] Rejected invalid revalidation paths:', rejectedPaths);
      }
    }

    const cachePages = path.resolve(__dirname, "../../../helpers/cachePages.js");
    const buildHtmlConfig = path.resolve(__dirname, "../../../scripts/build-html.js");

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
