#!/usr/bin/env node

/**
 * Create StaticJS App CLI
 * Scaffolds a new StaticJS application
 */

import {Command} from 'commander';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
    .name('create-staticjs-app')
    .description('Create a new StaticJS application')
    .version('1.0.0')
    .argument('<project-name>', 'Name of the project to create')
    .action(async (projectName: string) => {
        try {
            console.log(`🚀 Creating StaticJS app: ${projectName}`);

            const projectPath = path.resolve(process.cwd(), projectName);

            // Check if directory already exists
            if (fs.existsSync(projectPath)) {
                console.error(`❌ Directory ${projectName} already exists!`);
                process.exit(1);
            }

            // Create project directory
            fs.mkdirSync(projectPath, {recursive: true});

            // Copy template files (this would normally copy from a template)
            console.log('📁 Setting up project structure...');

            // Create basic package.json
            const packageJson = {
                name: projectName,
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
                },
                devDependencies: {
                    '@types/react': '^19.1.5',
                    '@types/react-dom': '^19.1.5',
                    typescript: '^5',
                    tsx: '^4.19.4'
                }
            };

            fs.writeFileSync(
                path.join(projectPath, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            console.log('✅ StaticJS app created successfully!');
            console.log(`\nNext steps:`);
            console.log(`  cd ${projectName}`);
            console.log(`  npm install`);
            console.log(`  npm run dev`);

        } catch (error) {
            console.error('❌ Failed to create app:', error);
            process.exit(1);
        }
    });

program.parse();
