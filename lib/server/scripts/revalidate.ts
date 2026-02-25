import { execFile as execFileCb } from "child_process";
import { promisify } from "node:util";
import { Request, Response } from "express";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";
import fs from "fs";
import * as os from "node:os";

const execFileAsync = promisify(execFileCb);

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
 * Get environment variables for child processes.
 * Passes the full parent environment since execFileAsync already
 * prevents shell injection and the child process is our own build script.
 */
const getSafeEnv = (): NodeJS.ProcessEnv => {
  return { ...process.env };
};

/**
 * Resolve the consumer's revalidate handler file.
 * Checks for src/revalidate.ts, .js, .mjs in the project root.
 */
const resolveRevalidateHandler = (projectRoot: string): string | null => {
  const extensions = ['.ts', '.js', '.mjs'];
  for (const ext of extensions) {
    const filePath = path.join(projectRoot, 'src', `revalidate${ext}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
};

interface RevalidateHandler {
  paths: string[];
  afterRevalidate?: (req: Request, paths: string[]) => Promise<void>;
}

/**
 * Import the consumer's revalidate module.
 * Returns the module exports, or null if no handler file exists.
 */
const importRevalidateModule = async (projectRoot: string): Promise<Record<string, unknown> | null> => {
  const handlerPath = resolveRevalidateHandler(projectRoot);
  if (!handlerPath) return null;

  try {
    return await import(`${handlerPath}?t=${Date.now()}`);
  } catch {
    if (handlerPath.endsWith('.ts')) {
      const esbuild = await import('esbuild');
      const tsContent = fs.readFileSync(handlerPath, 'utf-8');
      const { code } = await esbuild.transform(tsContent, { loader: 'ts', format: 'esm' });
      const tempFile = path.join(os.tmpdir(), `static-revalidate-${Date.now()}.mjs`);
      fs.writeFileSync(tempFile, code);
      try {
        return await import(tempFile);
      } finally {
        fs.unlinkSync(tempFile);
      }
    }
    throw new Error(`Failed to import revalidate handler: ${handlerPath}`);
  }
};

/**
 * Load the consumer's revalidate handler.
 * Calls the default export to get paths and extracts the optional afterRevalidate hook.
 * Returns null if no handler file exists.
 */
const loadRevalidateHandler = async (req: Request, projectRoot: string): Promise<RevalidateHandler | null> => {
  const mod = await importRevalidateModule(projectRoot);
  if (!mod) return null;

  const beforeFn = mod.beforeRevalidate;
  let paths: string[] | undefined;

  if (typeof beforeFn === 'function') {
    const result = await beforeFn(req);
    if (!Array.isArray(result)) {
      console.warn('[Revalidate] beforeRevalidate must return a string[]');
      return null;
    }
    paths = result;
  }

  return {
    paths: paths ?? [],
    afterRevalidate: typeof mod.afterRevalidate === 'function'
      ? mod.afterRevalidate as RevalidateHandler['afterRevalidate']
      : undefined,
  };
};

export const revalidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectRoot = process.cwd();

    // Try consumer's custom revalidate handler first, fall back to req.body.paths
    const handler = await loadRevalidateHandler(req, projectRoot);
    const rawPaths = handler?.paths ?? req?.body?.paths;

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
    const env = getSafeEnv();

    const cacheResult = await execFileAsync("node", [cachePages, ...paths], { env });
    if (cacheResult.stdout) console.log(`stdout: ${cacheResult.stdout}`);
    if (cacheResult.stderr) console.error(`stderr: ${cacheResult.stderr}`);

    const buildResult = await execFileAsync("npx", ["tsx", buildHtmlConfig, ...paths], { env });
    if (buildResult.stdout) console.log(`stdout: ${buildResult.stdout}`);
    if (buildResult.stderr) console.error(`stderr: ${buildResult.stderr}`);

    if (handler?.afterRevalidate) {
      await handler.afterRevalidate(req, paths);
    }

    res
      .status(200)
      .send(
        `Revalidation done, paths: ${
          paths.length > 0 ? paths.join(", ") : "all pages"
        } built!`
      );
  } catch (error) {
    console.error("Revalidation error:", error);
    res.status(500).send("Error during revalidation.");
  }
};
