import fs from "fs";
import path from "path";
import {findClosestLayout} from "./layoutDiscovery.js";

/**
 * Find a style file in a directory with the given base name,
 * preferring .scss over .css
 */
function findStyleFileByName(dir: string, baseName: string): string | null {
  const scssPath = path.join(dir, `${baseName}.scss`);
  const cssPath = path.join(dir, `${baseName}.css`);

  if (fs.existsSync(scssPath)) return scssPath;
  if (fs.existsSync(cssPath)) return cssPath;
  return null;
}

/**
 * Discovers all style files for a page, collecting:
 * 1. global.scss/css from the pages root directory (applied everywhere)
 * 2. layout.scss/css next to the closest layout.tsx (applied to all pages using that layout)
 * 3. page.scss/css (or style.scss/css fallback) next to the page's index.tsx
 *
 * Returns files in cascade order: global -> layout -> page
 */
export function findStyleFiles(pagePath: string, rootDir: string): string[] {
  const styleFiles: string[] = [];
  const pageDir = path.dirname(pagePath);
  const pagesDir = path.join(rootDir, "pages");

  // 1. Global styles: global.scss/css at pages root
  const globalStyle = findStyleFileByName(pagesDir, "global");
  if (globalStyle) {
    styleFiles.push(globalStyle);
  }

  // 2. Layout styles: layout.scss/css next to the closest layout.tsx
  const layoutPath = findClosestLayout(pagePath, rootDir);
  if (layoutPath) {
    const layoutDir = path.dirname(layoutPath);
    const layoutStyle = findStyleFileByName(layoutDir, "layout");
    if (layoutStyle) {
      styleFiles.push(layoutStyle);
    }
  }

  // 3. Page styles: page.scss/css next to index.tsx (with style.scss/css fallback)
  const pageStyle = findStyleFileByName(pageDir, "page") || findStyleFileByName(pageDir, "style");
  if (pageStyle) {
    styleFiles.push(pageStyle);
  }

  return styleFiles;
}

/**
 * Checks if a page has any styles (global, layout, or page-level)
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
