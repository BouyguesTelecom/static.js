#!/usr/bin/env node

/**
 * Generate Test Multi-Apps CLI
 * Creates multiple test applications for testing purposes
 */

import {Command} from 'commander';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
    .name('generate-test-multiapps')
    .description('Generate multiple test applications')
    .version('1.0.0')
    .argument('<command>', 'Command to execute (generate:test)')
    .action(async (command: string) => {
        try {
            if (command !== 'generate:test') {
                console.error(`❌ Unknown command: ${command}`);
                process.exit(1);
            }

            console.log('🧪 Generating test applications...');

            const testApps = ['test-app-1', 'test-app-2', 'test-app-3'];
            const baseDir = path.resolve(process.cwd(), 'test-apps');

            // Create test apps directory
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, {recursive: true});
            }

            for (const appName of testApps) {
                const appPath = path.join(baseDir, appName);

                // Skip if already exists
                if (fs.existsSync(appPath)) {
                    console.log(`⏭️  Skipping ${appName} (already exists)`);
                    continue;
                }

                console.log(`📁 Creating ${appName}...`);
                fs.mkdirSync(appPath, {recursive: true});

                // Create basic structure
                const srcPath = path.join(appPath, 'src');
                fs.mkdirSync(srcPath, {recursive: true});

                // Create package.json
                const packageJson = {
                    name: appName,
                    version: '1.0.0',
                    type: 'module',
                    scripts: {
                        dev: 'NODE_ENV=development tsx server.js',
                        build: 'bt-staticjs build',
                        start: 'npm run build && NODE_ENV=production tsx server.js'
                    },
                    dependencies: {
                        '@bouygues-telecom/staticjs': '*',
                        react: '^19.1.0',
                        'react-dom': '^19.1.0'
                    }
                };

                fs.writeFileSync(
                    path.join(appPath, 'package.json'),
                    JSON.stringify(packageJson, null, 2)
                );

                // Create basic React component
                const indexComponent = `import React from 'react';

export default function Index() {
  return (
    <div>
      <h1>Welcome to ${appName}</h1>
      <p>This is a test application generated for testing purposes.</p>
    </div>
  );
}
`;

                fs.writeFileSync(
                    path.join(srcPath, 'index.tsx'),
                    indexComponent
                );
            }

            console.log('✅ Test applications generated successfully!');
            console.log(`\nGenerated apps in: ${baseDir}`);

        } catch (error) {
            console.error('❌ Failed to generate test apps:', error);
            process.exit(1);
        }
    });

program.parse();
