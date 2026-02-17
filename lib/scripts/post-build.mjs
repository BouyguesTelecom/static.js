#!/usr/bin/env node

/**
 * Post-build script to rename compiled .js files to .mjs
 * This allows the package to work without "type": "module" in package.json
 * while still using ES module syntax (import/export, top-level await).
 */

import fs from 'node:fs';
import path from 'node:path';

const buildDir = path.resolve(process.cwd(), '_build');

function collectJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJsFiles(fullPath));
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.d.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const jsFiles = collectJsFiles(buildDir);

// Step 1: Fix .js references in import/export statements within each file
for (const file of jsFiles) {
  let content = fs.readFileSync(file, 'utf-8');

  // Replace .js in static import/export from statements: from "./foo.js" → from "./foo.mjs"
  content = content.replace(/(from\s+['"])([^'"]+)\.js(['"])/g, '$1$2.mjs$3');
  // Replace .js in dynamic import() statements: import("./foo.js") → import("./foo.mjs")
  content = content.replace(/(import\s*\(\s*['"])([^'"]+)\.js(['"])/g, '$1$2.mjs$3');

  fs.writeFileSync(file, content);
}

// Step 2: Rename .js files to .mjs
for (const file of jsFiles) {
  fs.renameSync(file, file.replace(/\.js$/, '.mjs'));
}

console.log(`[post-build] Renamed ${jsFiles.length} files from .js to .mjs`);
