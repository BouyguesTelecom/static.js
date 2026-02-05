import fs from "fs";
import path from "path";

/**
 * Discovers all style files (style.scss or style.css) by walking up the directory tree
 * from the given page path. Returns files in order from root to page for proper CSS cascade.
 */
export function findStyleFiles(pagePath: string, rootDir: string): string[] {
  const styleFiles: string[] = [];

  // Get the directory containing the page
  const pageDir = path.dirname(pagePath);

  // Collect all directories from root to page
  const directories: string[] = [];
  let currentDir = pageDir;

  while (currentDir.startsWith(rootDir) || currentDir === rootDir) {
    directories.unshift(currentDir); // Add to beginning for root-first order

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  // Also check the root src directory itself
  if (!directories.includes(rootDir)) {
    directories.unshift(rootDir);
  }

  // Check each directory for style files
  for (const dir of directories) {
    const styleFile = findStyleFileInDir(dir);
    if (styleFile) {
      styleFiles.push(styleFile);
    }
  }

  return styleFiles;
}

/**
 * Finds a style file in a directory, preferring .scss over .css
 */
function findStyleFileInDir(dir: string): string | null {
  const scssPath = path.join(dir, "style.scss");
  const cssPath = path.join(dir, "style.css");

  // Prefer .scss over .css
  if (fs.existsSync(scssPath)) {
    return scssPath;
  }

  if (fs.existsSync(cssPath)) {
    return cssPath;
  }

  return null;
}

/**
 * Checks if a page has any styles (either direct or inherited from layouts)
 */
export function hasStyles(pagePath: string, rootDir: string): boolean {
  return findStyleFiles(pagePath, rootDir).length > 0;
}

/**
 * Gets style files as relative paths for use in Vite entries
 */
export function getStyleFilesRelative(pagePath: string, rootDir: string, projectRoot: string): string[] {
  const absolutePaths = findStyleFiles(pagePath, rootDir);
  return absolutePaths.map(p => path.relative(projectRoot, p));
}
