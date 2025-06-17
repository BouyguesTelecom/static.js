import { defineConfig } from 'vite';

export default defineConfig({
    root: './dist',
    server: {
        port: 3300,
        host: true,
        open: 'page1.html',
    }
});
