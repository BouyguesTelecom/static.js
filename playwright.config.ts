import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    globalSetup: "./tests/support/playwright-global-setup.ts",
    // App preparation (pack, install, builds, servers) happens once in globalSetup.
    globalTimeout: 15 * 60_000,
    timeout: 30_000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", {open: "never"}]] : "list",
    use: {
        ...devices["Desktop Chrome"],
        trace: "retain-on-failure",
    },
    projects: [
        {name: "e2e", testMatch: ["pages.e2e.test.ts", "dev-cold-start.e2e.test.ts"]},
        {name: "consumers", testMatch: "consumers.e2e.test.ts"},
    ],
});
