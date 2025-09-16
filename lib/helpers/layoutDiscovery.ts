import fs from "fs";
import path from "path";

/**
 * Discovers the closest layout.tsx file by walking up the directory tree
 * from the given page path
 */
export function findClosestLayout(pagePath: string, rootDir: string): string | null {
  // Get the directory containing the page
  const pageDir = path.dirname(pagePath);
  
  // Start from the page's directory and walk up
  let currentDir = pageDir;
  
  while (true) {
    // Check if layout.tsx exists in current directory
    const layoutPath = path.join(currentDir, "layout.tsx");
    
    if (fs.existsSync(layoutPath)) {
      return layoutPath;
    }
    
    // Get parent directory
    const parentDir = path.dirname(currentDir);
    
    // If we've reached the root directory or can't go up further, stop
    if (parentDir === currentDir || !currentDir.startsWith(rootDir)) {
      break;
    }
    
    currentDir = parentDir;
  }
  
  // Fallback to global layout if no layout.tsx found in the hierarchy
  const globalLayoutPath = path.join(rootDir, "layout.tsx");
  if (fs.existsSync(globalLayoutPath)) {
    return globalLayoutPath;
  }
  
  return null;
}

/**
 * Gets the relative path from rootDir for layout identification
 */
export function getLayoutIdentifier(layoutPath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, layoutPath);
  return relativePath.replace(/\.tsx$/, "");
}