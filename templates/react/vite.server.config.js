import { defineConfig } from 'vite';
import path from 'path';
import sirv from 'sirv';
import chokidar from 'chokidar';

const distDir = path.resolve(__dirname, 'dist');

export default defineConfig({
    server: {
        port: 3300,
        host: true,
        open: '/page1.html',
    },
    plugins: [
        {
            name: 'serve-dist-and-watch',
            configureServer(server) {
                // Serve the dist directory
                server.middlewares.use(sirv(distDir, { dev: true }));

                // Watch dist & reload vite
                const watcher = chokidar.watch(distDir, { ignoreInitial: true });
                watcher.on('all', () => {
                    console.log('[vite] dist changed -> reload');
                    server.ws.send({ type: 'full-reload' });
                });
            },
        },
    ],
});