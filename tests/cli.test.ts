import {existsSync} from "node:fs";
import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {describe, expect, inject, it} from "vitest";
import {cloneApp, getFreePort, runStatic, startStatic} from "./support/app.js";

describe("static CLI", () => {
    const basicAppDir = inject("basicAppDir");

    it("documents the build, dev and start commands", async () => {
        const result = await runStatic(basicAppDir, ["--help"]);

        expect(result.code).toBe(0);
        expect(result.stdout).toContain("build");
        expect(result.stdout).toContain("dev");
        expect(result.stdout).toContain("start");
    });

    it("refuses to start in production without a build", async () => {
        const appDir = await cloneApp(basicAppDir, "cli-no-build", {withoutBuild: true});

        const result = await runStatic(appDir, ["start", "--port", String(await getFreePort())]);

        expect(result.code).toBe(1);
        expect(result.stdout + result.stderr).toContain("Build directory not found");
    });

    it("serves on the port given to `static start --port`", async () => {
        const server = await startStatic(basicAppDir, "start");
        try {
            expect((await fetch(`${server.url}/health`)).status).toBe(200);
        } finally {
            await server.stop();
        }
    });

    // Known bug: build-html catches and logs page errors, so a broken page still
    // produces a successful build (exit code 0) and CI cannot detect it.
    it.fails("[BUG] fails the build when a page throws during rendering", async () => {
        const appDir = await cloneApp(basicAppDir, "cli-broken-page", {withoutBuild: true});
        await mkdir(join(appDir, "src/pages/broken"), {recursive: true});
        await writeFile(join(appDir, "src/pages/broken/index.tsx"),
            `import React from "react";\nexport default function Broken(): React.JSX.Element { throw new Error("broken page"); }\n`);

        const result = await runStatic(appDir, ["build"]);

        expect(existsSync(join(appDir, "_build/home.html"))).toBe(true);
        expect(result.code).not.toBe(0);
    });

    // Known bug: PORT from static.config overrides `static start --port`.
    it.fails("[BUG] gives `static start --port` precedence over PORT in static.config", async () => {
        const configPort = await getFreePort();
        const cliPort = await getFreePort();
        const appDir = await cloneApp(basicAppDir, "cli-port", {config: {PORT: configPort}});

        // startStatic polls the CLI port and kills the process group when it never answers.
        const server = await startStatic(appDir, "start", {port: cliPort, timeoutMs: 20_000});
        await server.stop();
    });
});
