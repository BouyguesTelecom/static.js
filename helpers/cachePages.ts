import fs from "fs";
import path from "path";
import {readPages} from "./readPages.js";

/**
 * Generate cache entries for a given template directory
 * @param templateDir - The template directory path (e.g., "templates/react")
 * @param options - Optional configuration
 * @returns The generated cache entries object
 */
export const generateCacheEntries = (templateDir: string, options: {
    verbose?: boolean;
    rootDir?: string;
} = {}) => {
    const {verbose = true, rootDir = process.cwd()} = options;

    const pagesDir = path.resolve(rootDir, templateDir, "src/pages");
    const cacheDir = path.resolve(rootDir, templateDir, "cache");
    const cacheFilePath = path.resolve(cacheDir, "pagesCache.json");

    if (verbose) {
        console.log('\n🔄 Generating pages cache...');
    }

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
    if (verbose) {
        console.log(`   Generated cache file: ${cacheFilePath}`);
        console.log(`   Found ${Object.keys(entries).length} page(s)\n`);
    }

    return entries;
};

/**
 * Load cache entries with error handling and auto-generation
 * @param templateDir - The template directory path (e.g., "templates/react")
 * @param options - Optional configuration
 * @returns The loaded or generated cache entries object
 */
export const loadCacheEntries = (templateDir: string, options: {
    verbose?: boolean;
    rootDir?: string;
} = {}) => {
    const {verbose = true, rootDir = process.cwd()} = options;
    const cacheFilePath = path.resolve(rootDir, templateDir, "cache/pagesCache.json");

    try {
        if (!fs.existsSync(cacheFilePath)) {
            if (verbose) {
                console.log('\n📝 Cache file not found, generating automatically...');
            }
            return generateCacheEntries(templateDir, options);
        }

        const entries = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));

        if (!entries || typeof entries !== 'object') {
            if (verbose) {
                console.log('\n📝 Invalid cache file format, regenerating...');
            }
            return generateCacheEntries(templateDir, options);
        }

        if (verbose) {
            console.log(`\n✅ Loaded ${Object.keys(entries).length} cached page(s)`);
        }
        return entries;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (verbose) {
            console.error('\n❌ StaticJS Cache Error:');
            console.error(`   ${errorMessage}`);
            console.log('\n📝 Attempting to generate cache automatically...');
        }

        try {
            return generateCacheEntries(templateDir, options);
        } catch (generateError) {
            const generateErrorMessage = generateError instanceof Error ? generateError.message : String(generateError);
            if (verbose) {
                console.error('\n❌ Failed to generate cache automatically:');
                console.error(`   ${generateErrorMessage}`);
                console.error('\n💡 To fix this issue:');
                console.error('   1. Run: npm run build');
                console.error('   2. Or run: npm run dev (will auto-build if needed)');
                console.error('   3. Or run: npm run validate-setup\n');
            }

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
        const cacheDir = path.resolve(process.cwd(), templateDir, "cache");
        const cacheFilePath = path.resolve(cacheDir, "pagesCache.json");

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, {recursive: true});
        }

        fs.writeFileSync(cacheFilePath, JSON.stringify(entries, null, 2), "utf8");
        console.log("Pages cached successfully.");
        return entries;
    } else {
        // Use the modern API for full directory scanning
        return generateCacheEntries(templateDir, {verbose: true});
    }
};

// Legacy CLI support - maintain backward compatibility
// Only run CLI logic if this file is executed directly (not imported)
// Check if this is the main module using import.meta.url
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
    runCli();
}
