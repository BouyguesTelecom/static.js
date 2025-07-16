import { defineConfig } from 'vite';
import path from 'path';
import sirv from 'sirv';
import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const distDir = path.resolve(process.cwd(), 'dist');
const srcDir = path.resolve(process.cwd(), 'src');

let isBuilding = false;
let buildTimeout;

async function triggerBuild() {
    if (isBuilding) return;
    
    isBuilding = true;
    console.log('[staticjs] 🔨 Rebuilding...');
    
    try {
        const start = Date.now();
        await execAsync('npm run build:dev');
        const duration = Date.now() - start;
        console.log(`[staticjs] ✅ Build completed in ${duration}ms`);
    } catch (error) {
        console.error('[staticjs] ❌ Build failed:', error.message);
    } finally {
        isBuilding = false;
    }
}

export default defineConfig({
    server: {
        port: 3300,
        host: true,
        open: '/page1.html',
    },
    plugins: [
        {
            name: 'staticjs-hot-reload',
            configureServer(server) {
                // Serve static files from dist
                server.middlewares.use(sirv(distDir, { 
                    dev: true,
                    etag: false,
                    maxAge: 0,
                    single: false
                }));

                // Watch src directory for changes
                const srcWatcher = chokidar.watch(srcDir, { 
                    ignoreInitial: true,
                    ignored: /(^|[\/\\])\../,
                    persistent: true
                });

                srcWatcher.on('change', (filePath) => {
                    const relativePath = path.relative(process.cwd(), filePath);
                    console.log(`[staticjs] 📝 Changed: ${relativePath}`);
                    
                    // Debounce builds
                    clearTimeout(buildTimeout);
                    buildTimeout = setTimeout(triggerBuild, 300);
                });

                srcWatcher.on('add', (filePath) => {
                    const relativePath = path.relative(process.cwd(), filePath);
                    console.log(`[staticjs] ➕ Added: ${relativePath}`);
                    
                    clearTimeout(buildTimeout);
                    buildTimeout = setTimeout(triggerBuild, 300);
                });

                srcWatcher.on('unlink', (filePath) => {
                    const relativePath = path.relative(process.cwd(), filePath);
                    console.log(`[staticjs] ➖ Removed: ${relativePath}`);
                    
                    clearTimeout(buildTimeout);
                    buildTimeout = setTimeout(triggerBuild, 300);
                });

                // Watch dist directory for build completion and trigger reload
                const distWatcher = chokidar.watch(distDir, { 
                    ignoreInitial: true,
                    awaitWriteFinish: {
                        stabilityThreshold: 200,
                        pollInterval: 100
                    }
                });

                distWatcher.on('all', (event, filePath) => {
                    if (!isBuilding && (event === 'change' || event === 'add')) {
                        console.log('[staticjs] 🔄 Hot reloading...');
                        server.ws.send({ 
                            type: 'full-reload'
                        });
                    }
                });

                // Cleanup on server close
                server.httpServer?.on('close', () => {
                    srcWatcher?.close();
                    distWatcher?.close();
                });

                console.log('[staticjs] 🚀 Dev server ready with hot reload');
                console.log('[staticjs] 👀 Watching src/ for changes...');
            },
        },
    ],
});