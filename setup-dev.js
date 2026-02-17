#!/usr/bin/env node

/**
 * Development setup script for StaticJS
 * Links the local package to make CLI commands available
 */

const {execSync} = require('child_process');
const fs = require('fs');
const os = require('os');

console.log('🔧 Setting up StaticJS development environment...\n');

/**
 * Fix permission issues that can occur when files are created with sudo
 */
function fixPermissions() {
    console.log('🔒 Checking and fixing permissions...');
    
    const currentUser = os.userInfo().username;
    let permissionsFixed = false;
    
    // Check _build directory ownership
    const buildDir = 'lib/_build';
    if (fs.existsSync(buildDir)) {
        try {
            const stats = fs.statSync(buildDir);
            const dirOwner = execSync(`ls -ld "${buildDir}" | awk '{print $3}'`).toString().trim();
            
            if (dirOwner !== currentUser) {
                console.log(`   ⚠️  _build directory owned by '${dirOwner}', fixing...`);
                execSync(`sudo chown -R ${currentUser}:staff ${buildDir}`, {stdio: 'inherit'});
                permissionsFixed = true;
            }
        } catch (error) {
            console.log('   ⚠️  Could not check _build directory ownership');
        }
    }
    
    // Check CLI script execute permissions
    const cliScript = 'node_modules/@bouygues-telecom/staticjs/_build/scripts/cli.mjs';
    if (fs.existsSync(cliScript)) {
        try {
            const stats = fs.statSync(cliScript);
            const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
            
            if (!isExecutable) {
                console.log('   ⚠️  CLI script missing execute permissions, fixing...');
                execSync(`chmod +x ${cliScript}`);
                permissionsFixed = true;
            }
        } catch (error) {
            console.log('   ⚠️  Could not check CLI script permissions');
        }
    }
    
    if (permissionsFixed) {
        console.log('✅ Permissions fixed\n');
    } else {
        console.log('✅ Permissions look good\n');
    }
}

try {
    // Check if we're in the right directory
    if (!fs.existsSync('lib/package.json')) {
        console.error('❌ Please run this script from the root of the staticjs project');
        process.exit(1);
    }

    console.log('1️⃣ Building the lib package...');
    try {
        execSync('npm run build:lib', {stdio: 'inherit'});
        console.log('✅ Build completed\n');
    } catch (error) {
        console.log('⚠️  Build failed, but continuing with existing build...\n');
    }

    // Fix permissions after build
    fixPermissions();

    console.log('2️⃣ Linking the package globally...');
    try {
        execSync('cd lib && npm link', {stdio: 'inherit'});
        console.log('✅ Package linked globally\n');
    } catch (error) {
        console.log('⚠️  Global link failed, using direct paths instead...\n');
    }

    console.log('3️⃣ Linking in the template project...');
    try {
        execSync('cd templates/react && npm link @bouygues-telecom/staticjs', {stdio: 'inherit'});
        console.log('✅ Package linked in template\n');
    } catch (error) {
        console.log('⚠️  Template link failed, using direct paths instead...\n');
    }

    // Final permission check after linking
    fixPermissions();

    console.log('🎉 Setup complete! You can now use:');
    console.log('  cd templates/react');
    console.log('  npm run dev    # Start development server');
    console.log('  npm run build  # Build static site');
    console.log('  npm run start  # Serve built files');

} catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n💡 You can still use the direct paths in package.json scripts');
    process.exit(1);
}
