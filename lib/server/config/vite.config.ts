import path from "path";
import {defineConfig} from "vite";
import {addHydrationCodePlugin, noJsPlugin} from "./vite.plugin";
import {loadCacheEntries} from "../../helpers/cachePages.js";
import {CONFIG} from "./index";

// Load cache entries using the refactored helper function
const entries = loadCacheEntries(CONFIG.PROJECT_ROOT, true);

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(CONFIG.PROJECT_ROOT, "src")
        },
    },
    define: {
        "process.env": {
            NODE_ENV: "production",
        },
    },
    build: {
        outDir: path.resolve(CONFIG.PROJECT_ROOT, CONFIG.STATIC_DIR),
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
