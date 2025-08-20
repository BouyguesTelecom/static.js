import path from "path";
import { defineConfig } from "vite";
import { addHydrationCodePlugin, noJsPlugin } from "./vite.plugin";
import { loadCacheEntries } from "../helpers/cachePages.js";

// Fix: Use project root directory instead of config directory
const projectRoot = path.resolve(__dirname, '../../../');

// Load cache entries using the refactored helper function
const entries = loadCacheEntries("templates/react", {
  verbose: true,
  rootDir: projectRoot
});

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "templates/react/src"),
      "@static-js/server": path.resolve(projectRoot, "server/dist/src/index.js"),
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
  plugins: [noJsPlugin(entries), addHydrationCodePlugin(entries)],
});
