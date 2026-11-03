import {defineConfig} from "vitest/config";

// Tests packing/installing the library in a real app (slow, share a global setup).
const integrationTests = [
    "tests/package.test.ts",
    "tests/build.test.ts",
    "tests/dev-server.test.ts",
    "tests/production-server.test.ts",
    "tests/cli.test.ts",
];
// Browser tests are run by Playwright (playwright.config.ts).
const e2eTests = "tests/**/*.e2e.test.ts";

export default defineConfig({
    test: {
        // List every test so known bugs ("[BUG] ...") are visible in the output.
        reporters: ["verbose"],
        projects: [
            {
                test: {
                    name: "unit",
                    include: ["tests/*.test.{ts,tsx}"],
                    exclude: [...integrationTests, e2eTests],
                    environment: "node",
                    globalSetup: ["tests/support/ensure-lib-build.ts"],
                },
            },
            {
                test: {
                    name: "integration",
                    include: integrationTests,
                    environment: "node",
                    globalSetup: ["tests/support/vitest-global-setup.ts"],
                    testTimeout: 120_000,
                    hookTimeout: 300_000,
                },
            },
        ],
    },
});
