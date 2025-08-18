import {
  addHydrationCodePlugin,
  noJsPlugin,
} from "@bouygues-telecom/staticjs/config/vite.plugin.js";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import fs from "fs";

/**
 * Load cache entries with error handling
 */
const loadCacheEntries = () => {
  const cacheFilePath = "./cache/pagesCache.json";
  
  try {
    if (!fs.existsSync(cacheFilePath)) {
      throw new Error(`Cache file not found: ${cacheFilePath}`);
    }
    
    const entries = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
    
    if (!entries || typeof entries !== 'object') {
      throw new Error(`Invalid cache file format: ${cacheFilePath}`);
    }
    
    return entries;
  } catch (error) {
    console.error('\n❌ StaticJS Cache Error:');
    console.error(`   ${error.message}`);
    console.error('\n💡 To fix this issue:');
    console.error('   1. Run: npm run build');
    console.error('   2. Or run: npm run dev (will auto-build if needed)');
    console.error('   3. Or run: npm run validate-setup\n');
    
    // Return empty object to prevent Vite from crashing
    // This allows the build process to continue and generate the cache files
    return {};
  }
};

const entries = loadCacheEntries();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    "process.env": {
      NODE_ENV: "production",
    },
  },
  build: {
    rollupOptions: {
      input: entries,
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/vendor-[hash].js",
      },
    },
  },
  plugins: [react(), noJsPlugin(entries), addHydrationCodePlugin(entries)],
});
