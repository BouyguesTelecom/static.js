import {mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";

/** Creates a temporary directory tree from a `{ "relative/path": "content" }` map. */
export function createTree(files: Record<string, string>): { root: string; cleanup: () => void } {
    const root = mkdtempSync(join(realpathSync(tmpdir()), "staticjs-unit-"));
    for (const [relativePath, content] of Object.entries(files)) {
        const fullPath = join(root, relativePath);
        mkdirSync(dirname(fullPath), {recursive: true});
        writeFileSync(fullPath, content);
    }
    return {root, cleanup: () => rmSync(root, {recursive: true, force: true})};
}

/** Runs an ESM snippet in a separate Node.js process using `cwd` as working directory. */
export async function runModule(code: string, cwd: string, env: NodeJS.ProcessEnv = {}): Promise<{ stdout: string; stderr: string }> {
    const {execFile} = await import("node:child_process");
    const {promisify} = await import("node:util");
    const scriptDir = mkdtempSync(join(realpathSync(tmpdir()), "staticjs-script-"));
    const script = join(scriptDir, "run.mjs");
    writeFileSync(script, code);
    try {
        return await promisify(execFile)(process.execPath, [script], {cwd, env: {...process.env, ...env}});
    } finally {
        rmSync(scriptDir, {recursive: true, force: true});
    }
}
