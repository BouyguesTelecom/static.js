import path from "path";
import {
  addHydrationCodePlugin,
  noJsPlugin,
} from "static.js/config/vite.plugin.js";
import { defineConfig } from "vite";
import entries from "./cache/pagesCache.json";
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
  plugins: [noJsPlugin(entries), addHydrationCodePlugin(entries)],
});
