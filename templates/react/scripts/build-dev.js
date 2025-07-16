#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

async function buildDev() {
    try {
        console.log('Executing static.js dev config...');
        
        const dest = process.cwd();
        
        // Clean dist
        await execAsync('rimraf dist', { cwd: dest });
        
        // Cache pages
        const cachePagesPath = path.resolve(dest, '../../dist/helpers/cachePages.js');
        await execAsync(`rimraf cache && node ${cachePagesPath}`, { cwd: dest });
        
        // Build with Vite
        await execAsync('vite build', { cwd: dest });
        
        // Generate HTML with hot reload
        const buildHtmlDevPath = path.resolve(dest, '../../dist/scripts/build-html-dev.js');
        await execAsync(`tsx ${buildHtmlDevPath}`, { cwd: dest });
        
        console.log('Dev build completed successfully with hot reload');
    } catch (error) {
        console.error('Dev build failed:', error);
        process.exit(1);
    }
}

buildDev();