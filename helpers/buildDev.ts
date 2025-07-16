import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

interface BuildOptions {
  specificFiles?: string[];
  verbose?: boolean;
}

export async function buildDev(options: BuildOptions = {}) {
  const { specificFiles = [], verbose = false } = options;
  
  try {
    const start = Date.now();
    
    if (verbose) {
      console.log('[staticjs] Starting development build...');
      if (specificFiles.length > 0) {
        console.log('[staticjs] Changed files:', specificFiles.map(f => path.basename(f)).join(', '));
      }
    }

    // Use the bt-staticjs build command directly
    await execAsync('bt-staticjs build');
    
    const duration = Date.now() - start;
    if (verbose) {
      console.log(`[staticjs] Build completed in ${duration}ms`);
    }
    
    return { success: true, duration };
  } catch (error) {
    console.error('[staticjs] Build failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}