#!/usr/bin/env node

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';
import fs from 'fs';
import path from 'path';

console.log('🧪 Testing StaticJS development server...\n');

const projectRoot = path.resolve(process.cwd());
const testResults = [];

function addResult(test, success, message) {
    testResults.push({ test, success, message });
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
}

async function runTest() {
    try {
        // Test 1: Check if required files exist
        const requiredFiles = [
            'vite.dev.config.js',
            'scripts/dev.js',
            'package.json'
        ];

        for (const file of requiredFiles) {
            const filePath = path.join(projectRoot, file);
            if (fs.existsSync(filePath)) {
                addResult(`File ${file}`, true, 'exists');
            } else {
                addResult(`File ${file}`, false, 'missing');
            }
        }

        // Test 2: Check package.json scripts
        const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
        
        if (packageJson.scripts.dev) {
            addResult('npm run dev script', true, 'configured');
        } else {
            addResult('npm run dev script', false, 'missing');
        }

        // Test 3: Check if dependencies are installed
        if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
            addResult('Dependencies', true, 'installed');
        } else {
            addResult('Dependencies', false, 'run npm install first');
        }

        // Test 4: Try to build the project
        console.log('\n🔨 Testing build process...');
        const buildProcess = spawn('npm', ['run', 'build'], {
            cwd: projectRoot,
            stdio: 'pipe',
            shell: true
        });

        let buildOutput = '';
        buildProcess.stdout.on('data', (data) => {
            buildOutput += data.toString();
        });

        buildProcess.stderr.on('data', (data) => {
            buildOutput += data.toString();
        });

        const buildResult = await new Promise((resolve) => {
            buildProcess.on('close', (code) => {
                resolve(code === 0);
            });
        });

        if (buildResult) {
            addResult('Build process', true, 'successful');
        } else {
            addResult('Build process', false, 'failed - check logs');
            console.log('Build output:', buildOutput);
        }

        // Test 5: Check if dist folder was created
        if (fs.existsSync(path.join(projectRoot, 'dist'))) {
            const distFiles = fs.readdirSync(path.join(projectRoot, 'dist'));
            addResult('Dist folder', true, `created with ${distFiles.length} files`);
        } else {
            addResult('Dist folder', false, 'not created');
        }

    } catch (error) {
        addResult('Test execution', false, error.message);
    }

    // Summary
    console.log('\n📊 Test Summary:');
    const passed = testResults.filter(r => r.success).length;
    const total = testResults.length;
    
    console.log(`${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('\n🎉 All tests passed! Your development server is ready.');
        console.log('Run `npm run dev` to start developing.');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the issues above.');
    }
}

runTest().catch(console.error);