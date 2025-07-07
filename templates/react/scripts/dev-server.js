#!/usr/bin/env node

import express from 'express';
import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const execAsync = promisify(exec);
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3300;
const distDir = path.resolve(process.cwd(), 'dist');
const srcDir = path.resolve(process.cwd(), 'src');

let isBuilding = false;
let buildTimeout;

// WebSocket pour hot reload
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[staticjs] 🔌 Client connected');
    
    ws.on('close', () => {
        clients.delete(ws);
        console.log('[staticjs] 🔌 Client disconnected');
    });
});

function broadcastReload() {
    clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify({ type: 'reload' }));
        }
    });
}

async function triggerBuild() {
    if (isBuilding) return;
    
    isBuilding = true;
    console.log('[staticjs] 🔨 Rebuilding...');
    
    try {
        const start = Date.now();
        await execAsync('npm run build:dev');
        const duration = Date.now() - start;
        console.log(`[staticjs] ✅ Build completed in ${duration}ms`);
        
        // Attendre un peu que les fichiers soient écrits
        setTimeout(() => {
            console.log('[staticjs] 🔄 Broadcasting reload...');
            broadcastReload();
        }, 100);
        
    } catch (error) {
        console.error('[staticjs] ❌ Build failed:', error.message);
    } finally {
        isBuilding = false;
    }
}

// Middleware pour injecter le script de hot reload
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const filePath = path.join(distDir, req.path);
        
        if (fs.existsSync(filePath)) {
            let html = fs.readFileSync(filePath, 'utf8');
            
            // Injecter le script de hot reload
            const hotReloadScript = `
<script>
(function() {
    const ws = new WebSocket('ws://localhost:${PORT}');
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'reload') {
            console.log('[staticjs] 🔄 Hot reloading...');
            window.location.reload();
        }
    };
    
    ws.onopen = function() {
        console.log('[staticjs] 🔥 Hot reload connected');
    };
    
    ws.onclose = function() {
        console.log('[staticjs] ❌ Hot reload disconnected - attempting reconnection...');
        setTimeout(() => window.location.reload(), 1000);
    };
    
    ws.onerror = function(error) {
        console.log('[staticjs] ⚠️ Hot reload error:', error);
    };
})();
</script>`;
            
            // Injecter avant la fermeture du body
            html = html.replace('</body>', hotReloadScript + '\n</body>');
            
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
            return;
        }
    }
    
    next();
});

// Servir les fichiers statiques
app.use(express.static(distDir));

// Watcher pour les changements de fichiers
const srcWatcher = chokidar.watch(srcDir, { 
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../,
    persistent: true
});

srcWatcher.on('change', (filePath) => {
    const relativePath = path.relative(process.cwd(), filePath);
    console.log(`[staticjs] 📝 Changed: ${relativePath}`);
    
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

// Démarrer le serveur
server.listen(PORT, () => {
    console.log(`[staticjs] 🚀 Dev server running at http://localhost:${PORT}`);
    console.log(`[staticjs] 👀 Watching ${srcDir} for changes...`);
    console.log(`[staticjs] 🔥 Hot reload enabled`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
    console.log('\n[staticjs] 🛑 Shutting down dev server...');
    srcWatcher.close();
    server.close(() => {
        process.exit(0);
    });
});