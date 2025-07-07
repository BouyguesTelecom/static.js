#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('🚀 Starting StaticJS development server...');

// Initial build with hot reload
console.log('📦 Initial build with hot reload...');
const initialBuild = spawn('npm', ['run', 'build:dev'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true
});

initialBuild.on('close', (code) => {
    if (code === 0) {
        console.log('✅ Initial build completed');
        console.log('🔥 Starting dev server with hot reload...');
        
        // Start our custom dev server
        const devServer = spawn('node', ['scripts/dev-server.js'], {
            cwd: projectRoot,
            stdio: 'inherit',
            shell: true
        });

        devServer.on('close', (code) => {
            console.log(`\n🛑 Dev server exited with code ${code}`);
            process.exit(code);
        });

        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down dev server...');
            devServer.kill('SIGINT');
            setTimeout(() => process.exit(0), 1000);
        });

        process.on('SIGTERM', () => {
            devServer.kill('SIGTERM');
            setTimeout(() => process.exit(0), 1000);
        });

    } else {
        console.error('❌ Initial build failed');
        process.exit(1);
    }
});

initialBuild.on('error', (error) => {
    console.error('❌ Failed to start build process:', error);
    process.exit(1);
});