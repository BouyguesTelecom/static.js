import path from "path";
import { defineConfig } from "vite";
import { existsSync } from "fs";
import entries from "./cache/pagesCache.json";

// Import conditionnel : utilise le chemin relatif en local, le package en production
const localPluginPath = path.resolve(process.cwd(), "../../dist/config/vite.plugin.js");
const isLocalDevelopment = existsSync(localPluginPath);
const pluginPath = isLocalDevelopment
  ? localPluginPath
  : "@bouygues-telecom/staticjs/dist/config/vite.plugin.js";

const { addHydrationCodePlugin, noJsPlugin } = await import(pluginPath);

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
