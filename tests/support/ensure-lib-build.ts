import {existsSync, readdirSync, statSync} from "node:fs";
import {join} from "node:path";
import {libDir, runOrThrow} from "./app.js";

function newestMtime(dir: string, ignore: Set<string>): number {
    let newest = 0;
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        if (ignore.has(entry.name)) continue;
        const fullPath = join(dir, entry.name);
        const mtime = entry.isDirectory() ? newestMtime(fullPath, ignore) : statSync(fullPath).mtimeMs;
        newest = Math.max(newest, mtime);
    }
    return newest;
}

/** Rebuilds lib/_build when it is missing or older than the library sources. */
export default async function ensureLibBuild() {
    if (process.env.STATICJS_SKIP_LIB_BUILD === "1") return;
    const buildDir = join(libDir, "_build");
    const ignore = new Set(["_build", "node_modules"]);
    if (!existsSync(buildDir) || newestMtime(libDir, ignore) > statSync(join(buildDir, "server/index.mjs")).mtimeMs) {
        await runOrThrow("npm", ["run", "build"], {cwd: libDir});
    }
}
