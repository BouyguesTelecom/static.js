import fs from "fs";
import path from "path";
import {readPages} from "./readPages.js";
import {CONFIG} from "../server/config/index.js";
import {findStyleFiles} from "./styleDiscovery.js";

const generateExcludedFiles = (entries: { [key: string]: string }) => {
    const excludedFiles: string[] = [];

    Object.entries(entries).forEach(([name, path]) => {
        const content = fs.readFileSync(path, "utf8");
        const firstLine = content.split("\n")[0];

        if (firstLine.includes("no scripts")) {
            delete entries[name];
            excludedFiles.push(name);
            // File excluded from build due to "no scripts" directive
        }
    });

    try {
        const cacheDir = path.resolve(process.cwd(), CONFIG.BUILD_DIR, "cache");
        const excludedFilePath = path.resolve(cacheDir, "excludedFiles.json");

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, {recursive: true});
        }

        fs.writeFileSync(
            excludedFilePath,
            JSON.stringify(excludedFiles, null, 2),
            "utf8"
        );
    } catch (error) {
        console.error("Error generating excluded files:", error);
        throw error; // Re-throw to handle it in the caller
    }
};

/**
 * Generate styles cache for all pages
 * Maps each page name to its collected style files (from root layout to page)
 */
const generateStylesCache = (entries: { [key: string]: string }, projectDir: string) => {
    const stylesCache: { [key: string]: string[] } = {};
    const rootDir = path.resolve(projectDir, "src");

    Object.entries(entries).forEach(([pageName, pagePath]) => {
        const styleFiles = findStyleFiles(pagePath, rootDir);
        if (styleFiles.length > 0) {
            stylesCache[pageName] = styleFiles;
        }
    });

    try {
        const cacheDir = path.resolve(projectDir, CONFIG.BUILD_DIR, "cache");
        const stylesCachePath = path.resolve(cacheDir, "stylesCache.json");

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, {recursive: true});
        }

        fs.writeFileSync(
            stylesCachePath,
            JSON.stringify(stylesCache, null, 2),
            "utf8"
        );
    } catch (error) {
        console.error("Error generating styles cache:", error);
        throw error;
    }

    return stylesCache;
};

/**
 * Generate cache entries for a given template directory
 * @param projectDir - The template directory path (e.g., "templates/react")
 * @param verbose
 * @returns The generated cache entries object
 */
const generateCacheEntries = (projectDir: string, verbose: boolean = false) => {
    const pagesDir = path.resolve(projectDir, "src/pages");
    const cacheDir = path.resolve(projectDir, CONFIG.BUILD_DIR, "cache");
    const cacheFilePath = path.resolve(cacheDir, "pagesCache.json");

    // Generating pages cache (silent unless error)

    // Check if pages directory exists
    if (!fs.existsSync(pagesDir)) {
        if (verbose) {
            console.warn(`Pages directory not found: ${pagesDir}`);
        }
        return {};
    }

    // Scan for page files using existing helper
    const entries = readPages(pagesDir);

    // Create cache directory if it doesn't exist
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, {recursive: true});
        if (verbose) {
            console.log(`   Created cache directory: ${cacheDir}`);
        }
    }

    // Write cache file
    fs.writeFileSync(cacheFilePath, JSON.stringify(entries, null, 2), "utf8");

    generateExcludedFiles(entries);
    generateStylesCache(entries, projectDir);

    if (verbose) {
        console.log(`   Generated cache file: ${cacheFilePath}`);
        console.log(`   Found ${Object.keys(entries).length} page(s)\n`);
    }

    return entries;
};

/**
 * Load styles cache for a given project directory
 * @param projectDir - The template directory path (e.g., "templates/react")
 * @returns The styles cache object mapping page names to their style file paths
 */
export const loadStylesCache = (projectDir: string): { [key: string]: string[] } => {
    const stylesCachePath = path.resolve(projectDir, CONFIG.BUILD_DIR, "cache/stylesCache.json");

    try {
        if (fs.existsSync(stylesCachePath)) {
            return JSON.parse(fs.readFileSync(stylesCachePath, 'utf8'));
        }
    } catch (error) {
        // Styles cache doesn't exist or is invalid, return empty object
    }

    return {};
};

/**
 * Load cache entries with error handling and auto-generation
 * @param projectDir - The template directory path (e.g., "templates/react")
 * @param verbose
 * @returns The loaded or generated cache entries object
 */
export const loadCacheEntries = (projectDir: string, verbose: boolean = false) => {
    const cacheFilePath = path.resolve(projectDir, CONFIG.BUILD_DIR, "cache/pagesCache.json");

    try {
        if (!fs.existsSync(cacheFilePath)) {
            if (verbose) {
                console.log('\n📝 Cache file not found, generating automatically...');
            }
            return generateCacheEntries(projectDir, verbose);
        }

        const entries = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));

        if (!entries || typeof entries !== 'object') {
            if (verbose) {
                console.log('\n📝 Invalid cache file format, regenerating...');
            }
            return generateCacheEntries(projectDir, verbose);
        }

        if (verbose) {
            console.log(`\n✅ Loaded ${Object.keys(entries).length} cached page(s)`);
        }
        return entries;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('\n❌ StaticJS Cache Error:');
        console.error(`   ${errorMessage}`);
        console.log('\n📝 Attempting to generate cache automatically...');

        try {
            return generateCacheEntries(projectDir, verbose);
        } catch (generateError) {
            const generateErrorMessage = generateError instanceof Error ? generateError.message : String(generateError);
            console.error('\n❌ Failed to generate cache automatically:');
            console.error(`   ${generateErrorMessage}`);
            console.error('\n💡 To fix this issue:');
            console.error('   1. Run: npm run build');
            console.error('   2. Or run: npm run dev (will auto-build if needed)');
            console.error('   3. Or run: npm run validate-setup\n');

            // Return empty object to prevent Vite from crashing
            return {};
        }
    }
};

/**
 * Process CLI arguments to generate specific page entries
 * @param args - Command line arguments
 * @param pagesDir - Pages directory path
 * @returns Processed entries object
 */
const processCliArgs = (args: string[], pagesDir: string) => {
    return args
        .filter((arg: string) => arg.endsWith(".tsx"))
        .reduce((obj: { [key: string]: string }, tsxFile) => {
            console.log(`Processing arg: ${tsxFile}`);
            const relativePathWithoutExtension = tsxFile.replace(/\.tsx$/, "");
            const fullPath = path.resolve(pagesDir, tsxFile);
            obj[relativePathWithoutExtension] = fullPath;
            return obj;
        }, {});
};

/**
 * CLI wrapper that uses the modern API functions
 * @param templateDir - Template directory (defaults to current directory for backward compatibility)
 * @param specificFiles - Optional array of specific .tsx files to process
 */
export const runCli = (templateDir: string = ".", specificFiles?: string[]) => {
    const args = specificFiles || process.argv.slice(2);

    if (args.length > 0) {
        // Handle specific files by temporarily overriding readPages behavior
        const pagesDir = path.resolve(process.cwd(), templateDir, "src/pages");
        const entries = processCliArgs(args, pagesDir);

        // Use generateCacheEntries but with custom entries
        const cacheDir = path.resolve(process.cwd(), templateDir, CONFIG.BUILD_DIR, "cache");
        const cacheFilePath = path.resolve(cacheDir, "pagesCache.json");

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, {recursive: true});
        }

        fs.writeFileSync(cacheFilePath, JSON.stringify(entries, null, 2), "utf8");
        console.log("Pages cached successfully.");
        return entries;
    } else {
        // Use the modern API for full directory scanning
        return generateCacheEntries(templateDir, true);
    }
};

// Legacy CLI support - maintain backward compatibility
// Only run CLI logic if this file is executed directly (not imported)
// Check if this is the main module using import.meta.url
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    runCli();
}
