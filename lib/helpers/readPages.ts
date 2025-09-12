import fs from "fs";
import path from "path";

export function readPages(dir: string, baseDir = dir) {
  let result: { [key: string]: string } = {};
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Check if this directory contains an index.tsx file
      const indexPath = path.join(fullPath, "index.tsx");
      if (fs.existsSync(indexPath)) {
        // Create route path from folder structure
        const relPath = path.relative(baseDir, fullPath);
        result[relPath] = indexPath;
      }
      
      // Continue recursively searching for more pages
      const nested = readPages(fullPath, baseDir);
      result = { ...result, ...nested };
    }
    // Note: Direct .tsx files are no longer supported - only folder-based routes with index.tsx
  }

  return result;
}