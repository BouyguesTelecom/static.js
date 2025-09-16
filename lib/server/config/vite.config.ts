import path from "path";
import {defineConfig, loadEnv} from "vite";
import {addHydrationCodePlugin} from "./vite.plugin";
import {loadCacheEntries} from "../../helpers/cachePages.js";
import {CONFIG} from "./index";

// Load cache entries using the refactored helper function
const entries = loadCacheEntries(CONFIG.PROJECT_ROOT);

export default defineConfig(({ mode }) => {
    // Load environment variables from .env files
    // const env = loadEnv(mode, CONFIG.PROJECT_ROOT, '');
    // console.log(`[Vite] Loaded environment variables for mode: ${mode}`, env);

    return {
        resolve: {
            alias: {
                "@": path.resolve(CONFIG.PROJECT_ROOT, "src")
            },
        },
        build: {
            outDir: path.resolve(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR),
            emptyOutDir: false,
            rollupOptions: {
                input: entries,
                output: {
                    entryFileNames: "[name].js",
                    chunkFileNames: "assets/vendor-[hash].js",
                },
            },
        },
        plugins: [addHydrationCodePlugin(entries)],
    };
});
