import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { CONFIG } from "../server/config/index.js";
import { loadStylesCache, loadCacheEntries } from "../helpers/cachePages.js";

/**
 * Compile a single SCSS/CSS file using Vite's internal sass handling
 * Falls back to concatenating raw CSS if sass is not available
 */
async function compileScss(filePath: string): Promise<string> {
    try {
        // Try to use sass for SCSS compilation
        const sass = await import("sass");
        const result = sass.compile(filePath, {
            loadPaths: [path.resolve(CONFIG.PROJECT_ROOT, "src")],
            style: "compressed",
        });
        return result.css;
    } catch (error: any) {
        // If sass import fails or file is .css, read and return raw content
        if (filePath.endsWith(".css")) {
            return await fs.readFile(filePath, "utf-8");
        }
        // Re-throw SCSS compilation errors
        if (error.message && !error.message.includes("Cannot find module")) {
            throw error;
        }
        // If sass is not installed, try reading as raw CSS
        console.warn("sass package not found, reading file as raw CSS");
        return await fs.readFile(filePath, "utf-8");
    }
}

/**
 * Build CSS for all pages with styles
 */
async function buildCss(): Promise<void> {
    // Ensure cache is generated
    loadCacheEntries(CONFIG.PROJECT_ROOT);

    const stylesCache = loadStylesCache(CONFIG.PROJECT_ROOT);
    const pagesWithStyles = Object.keys(stylesCache);

    if (pagesWithStyles.length === 0) {
        console.log("No style files found, skipping CSS build.");
        return;
    }

    console.log(`\nBuilding CSS for ${pagesWithStyles.length} page(s)...`);

    for (const pageName of pagesWithStyles) {
        const styleFiles = stylesCache[pageName];

        try {
            // Compile all style files and concatenate
            const compiledStyles: string[] = [];

            for (const styleFile of styleFiles) {
                const compiled = await compileScss(styleFile);
                compiledStyles.push(`/* Source: ${path.basename(styleFile)} */\n${compiled}`);
            }

            const finalCss = compiledStyles.join("\n\n");

            // Determine output path (handle dynamic routes)
            const outputName = pageName.replace(/\/\[[^\]]+\]$/, "");
            const outputPath = path.join(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR, `${outputName}.css`);

            // Create directories if needed
            const outputDir = path.dirname(outputPath);
            if (!fsSync.existsSync(outputDir)) {
                fsSync.mkdirSync(outputDir, { recursive: true });
            }

            // Write compiled CSS
            await fs.writeFile(outputPath, finalCss, "utf-8");
            console.log(`✓ ${outputName}.css`);
        } catch (error) {
            console.error(`Error building CSS for ${pageName}:`, error);
        }
    }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    buildCss().catch(console.error);
}

export { buildCss };
