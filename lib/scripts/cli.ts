#!/usr/bin/env node

/**
 * CLI tool for StaticJS
 * Provides build, development, and start commands
 */

import {Command} from 'commander';
import {execSync} from 'child_process';
import * as path from "node:path";
import * as fs from "node:fs";
import {fileURLToPath} from 'node:url';

const program = new Command();

// Get the directory where this CLI script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the lib directory path (where the staticjs package is installed)
const libDir = path.resolve(__dirname, '..');

// Function to find the nearest package.json to determine project root
function findProjectRoot(): string {
    let currentDir = process.cwd();
    
    while (currentDir !== path.parse(currentDir).root) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }
    
    // Fallback to current working directory
    return process.cwd();
}

const projectRoot = findProjectRoot();

program
    .name('static')
    .description('StaticJS CLI tool')
    .version('1.0.0');

program
    .command('build')
    .description('Build the static site')
    .action(async () => {
        try {
            console.log('🔨 Building static site...');

            console.log("\n1️⃣ Building static HTML files from TSX...");
            const buildHtmlScript = path.join(libDir, 'scripts', 'build-html.js');
            const staticHtmlFilesBuildCommand = `npx tsx "${buildHtmlScript}"`;
            execSync(staticHtmlFilesBuildCommand, {
                stdio: 'inherit',
                cwd: projectRoot
            });

            console.log("\n2️⃣ Building assets with Vite...");
            const viteConfigPath = path.join(libDir, 'server', 'config', 'vite.config.js');
            const viteBuildCommand = `npx vite build --config "${viteConfigPath}"`;
            execSync(viteBuildCommand, {
                stdio: 'inherit',
                cwd: projectRoot
            });

            console.log("\n3️⃣ Cleanup...");
            const cacheDir = path.join(projectRoot, '_build', 'cache');
            if (fs.existsSync(cacheDir)) {
                const cleanupCommand = process.platform === 'win32'
                    ? `rmdir /s /q "${cacheDir}"`
                    : `rm -rf "${cacheDir}"`;
                execSync(cleanupCommand, {
                    stdio: 'inherit',
                    cwd: projectRoot
                });
            }

            console.log('\n✅ Build completed successfully!');
        } catch (error) {
            console.error('\n❌ Build failed:', error);
            process.exit(1);
        }
    });

program
    .command('dev')
    .description('Start development server')
    .action(async () => {
        try {
            console.log('🚀 Starting development server...');

            const devCommand = `NODE_ENV=development tsx server.js`;
            execSync(devCommand, {
                stdio: 'inherit',
                cwd: projectRoot
            });
        } catch (error) {
            console.error('❌ Development server failed:', error);
            process.exit(1);
        }
    });

program
    .command('start')
    .description('Start production server to serve built static files')
    .option('-p, --port <port>', 'Port to serve on', '3456')
    .option('-h, --host <host>', 'Host to serve on', 'localhost')
    .action(async (options) => {
        try {
            console.log('🌐 Starting production server...');
            
            const buildDir = path.join(projectRoot, '_build');
            
            // Check if build directory exists
            if (!fs.existsSync(buildDir)) {
                console.error('❌ Build directory not found. Please run "static build" first.');
                process.exit(1);
            }

            console.log(`📁 Serving files from: ${buildDir}`);
            console.log(`🔗 Server running at: http://${options.host}:${options.port}`);
            
            // Use http-server to serve the built files
            const startCommand = `npx http-server "${buildDir}" -p ${options.port} -a ${options.host} -c-1`;
            execSync(startCommand, {
                stdio: 'inherit',
                cwd: projectRoot
            });
        } catch (error) {
            console.error('❌ Production server failed:', error);
            process.exit(1);
        }
    });

program.parse();
