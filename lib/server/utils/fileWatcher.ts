/**
 * File watcher system for hot reloading
 * Watches source files and triggers WebSocket broadcasts on changes
 */

import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { broadcastReload } from './websocket.js';
import { isDevelopment } from '../config/index.js';
import { invalidateRuntimeCache } from '../middleware/runtime.js';

type ReloadType = 'style' | 'page' | 'full' | 'asset';
type FileEvent = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

let watcher: FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_DELAY = 300; // 300ms debounce

/**
 * Determine reload type based on file extension
 */
const getReloadType = (filePath: string): ReloadType => {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
        case '.css':
        case '.scss':
        case '.sass':
        case '.less':
            return 'style';
        
        case '.tsx':
        case '.jsx':
        case '.ts':
        case '.js':
            return 'page';
        
        case '.json':
        case '.config.js':
        case '.config.ts':
            return 'full';
        
        case '.png':
        case '.jpg':
        case '.jpeg':
        case '.gif':
        case '.svg':
        case '.ico':
        case '.woff':
        case '.woff2':
        case '.ttf':
        case '.eot':
            return 'asset';
        
        default:
            return 'page';
    }
};

/**
 * Handle file change with debouncing
 */
const handleFileChange = (eventType: FileEvent, filePath: string): void => {
    // Clear existing timer
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    // Set new timer
    debounceTimer = setTimeout(async () => {
        const reloadType = getReloadType(filePath);
        const relativePath = path.relative(process.cwd(), filePath);
        
        // Invalidate runtime cache when source files change
        if (relativePath.includes('src/') || relativePath.includes('src\\')) {
            await invalidateRuntimeCache();
        }
        
        // Broadcast reload message to WebSocket clients
        broadcastReload(reloadType, {
            file: relativePath,
            event: eventType,
            timestamp: Date.now()
        });
        
        debounceTimer = null;
    }, DEBOUNCE_DELAY);
};

/**
 * Initialize file watcher
 */
export const initializeFileWatcher = (): FSWatcher | null => {
    if (!isDevelopment) {
        // Skipping file watcher in production mode
        return null;
    }

    try {
        // Define paths to watch based on current working directory
        const cwd = process.cwd();
        
        const watchPaths = [
            'src',                // Source directory
            'src/**/*',           // All source files in current directory
            'package.json',       // Dependency changes
            'tsconfig.json',      // TypeScript configuration
            'eslint.config.js'    // ESLint configuration
        ];

        // If we're in the main project directory, also watch template directories
        if (cwd.includes('static.js') && !cwd.includes('templates/')) {
            watchPaths.push(
                'templates/**/src/**/*',     // Template source files
                'templates/**/package.json', // Template dependencies
                'templates/**/tsconfig.json'    // Template TypeScript configs
            );
        }

        // Create watcher with options
        watcher = chokidar.watch(watchPaths, {
            ignored: [
                '**/node_modules/**',
                '**/_build/**',
                '**/node_modules/**',
                '**/.git/**',
                '**/coverage/**',
                '**/*.log',
                '**/.*'
            ],
            ignoreInitial: true,
            persistent: true,
            followSymlinks: true,
            depth: 10, // Allow deep directory watching
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            }
        });

        // Set up event handlers
        watcher
            .on('add', (filePath: string) => handleFileChange('add', filePath))
            .on('change', (filePath: string) => handleFileChange('change', filePath))
            .on('unlink', (filePath: string) => handleFileChange('unlink', filePath))
            .on('addDir', (dirPath: string) => {
                // Directory added (silent)
            })
            .on('unlinkDir', (dirPath: string) => {
                // Directory removed, triggering full reload
                // Trigger full reload when directories are removed
                broadcastReload('full', {
                    directory: path.relative(process.cwd(), dirPath),
                    event: 'unlinkDir'
                });
            })
            .on('error', (err: unknown) => {
                console.error('[FileWatcher] Watcher error:', err);
            })
            .on('ready', () => {
                const watched = watcher!.getWatched();
                const watchedPaths = Object.keys(watched);
                // File watcher initialized
            });

        return watcher;
    } catch (error) {
        console.error('[FileWatcher] Failed to initialize file watcher:', error);
        return null;
    }
};

/**
 * Get current file watcher instance
 */
export const getFileWatcher = (): FSWatcher | null => watcher;

/**
 * Get watched files count
 */
export const getWatchedFilesCount = (): number => {
    if (!watcher) return 0;
    
    const watched = watcher.getWatched();
    return Object.values(watched).reduce((total: number, files: string[]) => total + files.length, 0);
};

/**
 * Close file watcher and cleanup
 */
export const closeFileWatcher = async (): Promise<void> => {
    if (!watcher) {
        return;
    }

    return new Promise<void>((resolve) => {
        // Closing file watcher
        
        // Clear debounce timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }

        // Close watcher
        watcher!.close().then(() => {
            // File watcher closed
            watcher = null;
            resolve();
        }).catch((error: Error) => {
            console.error('[FileWatcher] Error closing file watcher:', error);
            watcher = null;
            resolve();
        });
    });
};

/**
 * Manually trigger a reload (useful for testing)
 */
export const triggerReload = (type: ReloadType = 'page', data: Record<string, any> = {}): void => {
    // Manually triggering reload
    broadcastReload(type, { ...data, manual: true });
};
