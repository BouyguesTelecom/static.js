import path from "path";
import { defineConfig } from "vite";
import { addHydrationCodePlugin, noJsPlugin } from "./config/vite.plugin";
import entries from "./templates/react/cache/pagesCache.json";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "templates/react/src"),
      "@static-js/server": path.resolve(__dirname, "server/dist/src/index.js"),
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
