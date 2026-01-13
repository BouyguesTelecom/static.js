import path from "path";
import {defineConfig, loadEnv} from "vite";
import {addHydrationCodePlugin} from "./vite.plugin";
import {loadCacheEntries} from "../../helpers/cachePages.js";

// Fallback configuration for build context
const PROJECT_ROOT = process.cwd();
const BUILD_DIR = "_build";

// Load cache entries using the current working directory
const entries = loadCacheEntries(PROJECT_ROOT);

// Fallback if no entries are found to prevent Rollup error
const safeEntries = entries && Object.keys(entries).length > 0 ? entries : {
    'index': path.resolve(PROJECT_ROOT, 'src/pages/home/index.tsx')
};

console.log('[Vite Config] Loaded entries:', Object.keys(safeEntries));

export default defineConfig(({ mode }) => {
    // Load environment variables from .env files
    // const env = loadEnv(mode, CONFIG.PROJECT_ROOT, '');
    // console.log(`[Vite] Loaded environment variables for mode: ${mode}`, env);

    return {
        resolve: {
            alias: {
                "@": path.resolve(PROJECT_ROOT, "src")
            },
        },
        build: {
            outDir: path.resolve(PROJECT_ROOT, BUILD_DIR),
            emptyOutDir: false,
            rollupOptions: {
                input: safeEntries,
                output: {
                    entryFileNames: "[name].js",
                    chunkFileNames: "assets/vendor-[hash].js",
                },
            },
        },
        plugins: [addHydrationCodePlugin(safeEntries)],
    };
});
