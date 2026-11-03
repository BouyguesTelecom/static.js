import {cp, rm, symlink} from "node:fs/promises";
import {join} from "node:path";
import {chromium} from "@playwright/test";
import {
    buildApp,
    cloneApp,
    fixturesDir,
    getFreePort,
    installFixtureApp,
    packLib,
    runOrThrow,
    startProcess,
    startStatic,
    workDir,
} from "./app.js";
import {startHostServer} from "./host-server.js";

/**
 * Prepares every application used by the Playwright suites and exposes their URLs via env:
 *  - STATICJS_START_URL: fixture app served by `static start` (production)
 *  - STATICJS_DEV_URL:   same app served by `static dev`
 *  - STATICJS_HOST_URL:  Caddy-like host serving plain HTML pages that include fragments of
 *                        app1 (BASE_PATH /app1) and app2 (BASE_PATH /app2)
 *  - STATICJS_VITE_URL:  Vite host app (vite build + vite preview) consuming the same fragments
 */
export default async function globalSetup() {
    const stops: (() => Promise<void>)[] = [];
    const teardown = async () => {
        for (const stop of stops.reverse()) await stop().catch(() => undefined);
    };

    try {
        const tarball = await packLib();
        const basicAppDir = await installFixtureApp({tarball, name: "basic-app"});
        await buildApp(basicAppDir);

        const apps: Record<string, string> = {};
        for (const name of ["app1", "app2"]) {
            const appDir = await cloneApp(basicAppDir, `e2e-${name}`, {
                withoutBuild: true,
                config: {BASE_PATH: `/${name}`, DECODE_TEMPLATE_EXPRESSIONS: true},
            });
            await buildApp(appDir, {FIXTURE_LABEL: name});
            apps[`/${name}`] = join(appDir, "_build");
        }

        const production = await startStatic(basicAppDir, "start");
        stops.push(production.stop);
        process.env.STATICJS_START_URL = production.url;

        const devAppDir = await cloneApp(basicAppDir, "e2e-dev", {withoutBuild: true});
        const dev = await startStatic(devAppDir, "dev", {readyPath: "/home"});
        stops.push(dev.stop);
        process.env.STATICJS_DEV_URL = dev.url;
        // A fresh dev server breaks the first page load (see dev-cold-start.e2e.test.ts): warm it up
        // so the other dev tests are not order-dependent.
        await warmUp(`${dev.url}/home`);

        const host = await startHostServer([
            {prefix: "/app1", dirs: [apps["/app1"]]},
            {prefix: "/app2", dirs: [apps["/app2"]]},
            {prefix: "/", dirs: [join(fixturesDir, "host-html")]},
        ]);
        stops.push(host.close);
        process.env.STATICJS_HOST_URL = host.url;

        // The Vite host reuses the fixture app's node_modules (vite is installed there).
        const viteDir = join(workDir, "e2e-host-vite");
        await rm(viteDir, {recursive: true, force: true});
        await cp(join(fixturesDir, "host-vite"), viteDir, {recursive: true});
        await symlink(join(basicAppDir, "node_modules"), join(viteDir, "node_modules"), "dir");
        const viteBin = join(viteDir, "node_modules/vite/bin/vite.js");
        const viteEnv = {STATICJS_FRAGMENT_BUILDS: JSON.stringify(apps), STATICJS_HOST_URL: host.url};
        await runOrThrow(process.execPath, [viteBin, "build"], {cwd: viteDir, env: viteEnv});
        const vitePort = await getFreePort();
        const viteUrl = `http://127.0.0.1:${vitePort}`;
        const vite = await startProcess(process.execPath,
            [viteBin, "preview", "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"],
            {cwd: viteDir, env: viteEnv, readyUrl: viteUrl});
        stops.push(vite.stop);
        process.env.STATICJS_VITE_URL = viteUrl;
    } catch (error) {
        await teardown();
        throw error;
    }

    return teardown;
}

async function warmUp(url: string): Promise<void> {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2_000);
    } finally {
        await browser.close();
    }
}
