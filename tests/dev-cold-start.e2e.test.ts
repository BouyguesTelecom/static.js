import {join} from "node:path";
import {expect, test} from "@playwright/test";
import {cloneApp, startStatic, workDir, type RunningServer} from "./support/app.js";
import {trackErrors} from "./support/browser.js";

// Known bug: on a fresh `static dev`, Vite discovers react-dom/client on the first request and
// re-optimizes its deps. StaticJS does not inject Vite's client, so the browser is not reloaded
// and the first page mixes two React copies ("Invalid hook call"); a manual reload fixes it.
// Possible fix (not verified): pre-bundle react, react-dom and react-dom/client via optimizeDeps.include.
test.describe("static dev cold start", () => {
    let server: RunningServer;

    test.beforeAll(async () => {
        test.setTimeout(120_000);
        const appDir = await cloneApp(join(workDir, "basic-app"), "e2e-dev-cold", {withoutBuild: true});
        server = await startStatic(appDir, "dev", {readyPath: "/api/pages"});
    });

    test.afterAll(async () => {
        await server?.stop();
    });

    test("[BUG] hydrates the very first page requested", async ({page}) => {
        test.fail();
        const errors = trackErrors(page);
        await page.goto(`${server.url}/home`);

        await expect(page.getByTestId("hydrated")).toHaveText("hydrated");
        expect(errors).toEqual([]);
    });
});
