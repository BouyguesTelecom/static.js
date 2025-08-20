#!/usr/bin/env node

/**
 * CLI tool for StaticJS
 * Provides build and development commands
 */

import {Command} from 'commander';
import {execSync} from 'child_process';

const program = new Command();

program
    .name('bt-staticjs')
    .description('StaticJS CLI tool')
    .version('1.0.0');

program
    .command('build')
    .description('Build the static site')
    .action(async () => {
        try {
            console.log('🔨 Building static site...');
            console.log("\n1️⃣ Building assets with Vite...");

            const viteBuildCommand = 'npx vite build --config ../../lib/server/config/vite.config.ts';
            execSync(viteBuildCommand, {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            console.log("\n2️⃣ Building static HTML files from TSX...");
            const staticHtmlFilesBuildCommand = 'npx tsx ../../lib/scripts/build-html.ts';
            execSync(staticHtmlFilesBuildCommand, {
                stdio: 'inherit',
                cwd: process.cwd()
            });

            console.log('✅ Build completed successfully!');
        } catch (error) {
            console.error('❌ Build failed:', error);
            process.exit(1);
        }
    });

program
    .command('dev')
    .description('Start development server')
    .action(async () => {
        try {
            console.log('🚀 Starting development server...');

            // Start the development server
            const devCommand = 'npx vite --config ../../lib/server/config/vite.config.ts';
            execSync(devCommand, {
                stdio: 'inherit',
                cwd: process.cwd()
            });
        } catch (error) {
            console.error('❌ Development server failed:', error);
            process.exit(1);
        }
    });

program.parse();
