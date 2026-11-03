import {readFileSync} from "node:fs";
import {join} from "node:path";
import {beforeAll, describe, expect, inject, it} from "vitest";
import {libDir, run, runOrThrow} from "./support/app.js";

interface TarEntry {
    path: string;
    mode: string;
}

const libPackageJson = JSON.parse(readFileSync(join(libDir, "package.json"), "utf8"));

describe("published package (npm pack)", () => {
    const tarball = inject("tarball");
    const appDir = inject("basicAppDir");
    let entries: TarEntry[] = [];
    const has = (path: string) => entries.some((entry) => entry.path === `package/${path.replace(/^\.\//, "")}`);

    beforeAll(async () => {
        const {stdout} = await runOrThrow("tar", ["-tvzf", tarball], {cwd: libDir});
        entries = stdout.trim().split("\n").map((line) => {
            const parts = line.trim().split(/\s+/);
            return {mode: parts[0], path: parts[parts.length - 1]};
        });
    });

    it("ships every file referenced by the exports map", () => {
        const targets = Object.values(libPackageJson.exports as Record<string, Record<string, string>>)
            .flatMap((conditions) => Object.values(conditions));

        expect(targets.length).toBeGreaterThan(0);
        for (const target of targets) {
            expect(has(target), `${target} missing from tarball`).toBe(true);
        }
        expect(has(libPackageJson.main)).toBe(true);
    });

    it("ships executable bin scripts with a node shebang", () => {
        for (const [name, target] of Object.entries(libPackageJson.bin as Record<string, string>)) {
            const entry = entries.find((e) => e.path === `package/${target.replace(/^\.\//, "")}`);
            expect(entry, `bin ${name} -> ${target} missing`).toBeDefined();
            expect(entry!.mode, `bin ${name} is not executable`).toMatch(/^-rwx/);
            const installed = readFileSync(join(appDir, "node_modules/@bouygues-telecom/staticjs", target), "utf8");
            expect(installed.startsWith("#!/usr/bin/env node")).toBe(true);
        }
    });

    it("ships the build scripts invoked by the CLI and the hot reload client", () => {
        for (const file of [
            "_build/scripts/build-html.mjs",
            "_build/scripts/build-css.mjs",
            "_build/server/config/vite.config.mjs",
            "_build/server/index.mjs",
            "_build/helpers/cachePages.mjs",
            "_build/server/static/hot-reload-client.js",
        ]) {
            expect(has(file), `${file} missing`).toBe(true);
        }
    });

    it("does not leak sources, tests or build caches", () => {
        const leaked = entries
            .map((entry) => entry.path)
            .filter((path) => (/\.tsx?$/.test(path) && !path.endsWith(".d.ts")) || /\/(tests?|cache|node_modules)\//.test(path));

        expect(leaked).toEqual([]);
    });

    it("only references relative .mjs modules from compiled files", () => {
        const offenders = entries
            .map((entry) => entry.path.replace(/^package\//, ""))
            .filter((path) => path.endsWith(".mjs"))
            .filter((path) => {
                const code = readFileSync(join(appDir, "node_modules/@bouygues-telecom/staticjs", path), "utf8");
                return /from\s+["']\.{1,2}\/[^"']+\.js["']/.test(code);
            });

        expect(offenders).toEqual([]);
    });

    // Known issue: "files" lists README.md but lib/ has no README, so the npm page is empty.
    it.fails("[BUG] ships a README", () => {
        expect(has("README.md")).toBe(true);
    });
});

describe("installed package in a consumer app", () => {
    const appDir = inject("basicAppDir");

    it("resolves every public entry point from Node.js", async () => {
        const subpaths = Object.keys(libPackageJson.exports).map((key) => key.replace(/^\./, "@bouygues-telecom/staticjs"));
        const script = `
            for (const id of ${JSON.stringify(subpaths)}) {
                const mod = await import(id);
                if (!mod || Object.keys(mod).length === 0) throw new Error("empty module " + id);
            }
            const head = await import("@bouygues-telecom/staticjs/head");
            const serverOnly = await import("@bouygues-telecom/staticjs/server-only");
            if (typeof head.Head !== "function") throw new Error("Head export missing");
            if (typeof serverOnly.ServerOnly !== "function" || typeof serverOnly.ServerElement !== "function") throw new Error("ServerOnly exports missing");
            console.log("OK");
            process.exit(0);
        `;
        const result = await run(process.execPath, ["--input-type=module", "-e", script], {cwd: appDir});

        expect(result.stderr).not.toMatch(/ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED/);
        expect(result.stdout).toContain("OK");
        expect(result.code).toBe(0);
    });

    it("type-checks consumer pages importing the public subpaths", async () => {
        const result = await run(join(appDir, "node_modules/.bin/tsc"), ["--noEmit", "-p", "."], {cwd: appDir});

        expect(result.stdout + result.stderr).not.toMatch(/Cannot find module '@bouygues-telecom\/staticjs/);
        expect(result.code, result.stdout).toBe(0);
    });

    it("has its dependencies and peer dependencies satisfied", async () => {
        const result = await run("npm", ["ls", "@bouygues-telecom/staticjs", "vite", "react", "react-dom", "sass"], {cwd: appDir});

        expect(result.stdout + result.stderr).not.toMatch(/UNMET|invalid|missing/i);
        expect(result.code).toBe(0);
    });

    it("exposes the CLI binaries", async () => {
        for (const bin of ["static", "bt-staticjs"]) {
            const result = await run(join(appDir, "node_modules/.bin", bin), ["--help"], {cwd: appDir});
            expect(result.code).toBe(0);
            expect(result.stdout).toMatch(/build[\s\S]*dev[\s\S]*start/);
        }
    });
});
