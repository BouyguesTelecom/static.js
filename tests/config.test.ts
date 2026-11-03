import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {afterEach, describe, expect, it} from "vitest";
import {repoRoot} from "./support/app.js";
import {createTree, runModule} from "./support/tree.js";

const configModule = pathToFileURL(join(repoRoot, "lib/_build/server/config/index.mjs")).href;

/**
 * CONFIG is computed at import time from process.cwd(), so it is loaded in a child process.
 * The compiled .mjs is used because the source relies on top-level await in a CommonJS package.
 */
async function loadConfig(files: Record<string, string>, env: NodeJS.ProcessEnv = {}) {
    const tree = createTree(files);
    try {
        const script = `const m = await import(${JSON.stringify(configModule)}); console.log("__CONFIG__" + JSON.stringify(m.CONFIG));`;
        const {stdout, stderr} = await runModule(script, tree.root, {
            NODE_ENV: "", PORT: "", REVALIDATE_API_KEY: "", CORS_ORIGINS: "", ...env,
        });
        const line = stdout.split("\n").find((l) => l.startsWith("__CONFIG__"))!;
        return {config: JSON.parse(line.slice("__CONFIG__".length)), output: stdout + stderr, root: tree.root};
    } finally {
        tree.cleanup();
    }
}

describe("CONFIG loading", () => {
    let cleanup = () => {};
    afterEach(() => cleanup());

    it("uses documented defaults without a config file", async () => {
        const {config} = await loadConfig({});

        expect(config).toMatchObject({
            PORT: 3456,
            BUILD_DIR: "_build",
            RATE_LIMIT_MAX: 100,
            DECODE_TEMPLATE_EXPRESSIONS: false,
            BASE_PATH: "",
            TRUST_PROXY: 1,
            CSP_DIRECTIVES: {},
        });
    });

    it("loads static.config.ts and merges it with defaults", async () => {
        const {config} = await loadConfig({
            "static.config.ts": `const config: Record<string, unknown> = { PORT: 5678, BASE_PATH: "/statics/", DECODE_TEMPLATE_EXPRESSIONS: true };\nexport default config;`,
        });

        expect(config.PORT).toBe(5678);
        expect(config.BASE_PATH).toBe("/statics");
        expect(config.DECODE_TEMPLATE_EXPRESSIONS).toBe(true);
        expect(config.BUILD_DIR).toBe("_build");
    });

    it("prefers static.config.js over static.config.ts", async () => {
        const {config} = await loadConfig({
            "package.json": `{"type":"module"}`,
            "static.config.js": "export default { PORT: 1111 };",
            "static.config.ts": "export default { PORT: 2222 };",
        });

        expect(config.PORT).toBe(1111);
    });

    it("ignores unknown keys and invalid values with a warning", async () => {
        const {config, output} = await loadConfig({
            "static.config.mjs": `export default {
                PORT: 70000,
                BUILD_DIR: "../../etc",
                REVALIDATE_API_KEY: "short",
                CORS_ORIGINS: ["javascript:alert(1)"],
                TRUST_PROXY: true,
                NOT_A_KEY: 1,
                RATE_LIMIT_MAX: 500
            };`,
        });

        expect(config.PORT).toBe(3456);
        expect(config.BUILD_DIR).toBe("_build");
        expect(config.REVALIDATE_API_KEY).toBe("");
        expect(config.CORS_ORIGINS).toEqual([]);
        expect(config.TRUST_PROXY).toBe(1);
        expect(config.RATE_LIMIT_MAX).toBe(500);
        expect(output).toContain("Ignoring unknown config key: NOT_A_KEY");
        expect(output).toContain("Invalid value for PORT");
        expect(output).toContain("Invalid value for TRUST_PROXY");
    });

    it("derives environment dependent values from NODE_ENV", async () => {
        const production = await loadConfig({}, {NODE_ENV: "production"});
        expect(production.config).toMatchObject({CACHE_MAX_AGE: 86400, HOT_RELOAD_ENABLED: false, WEBSOCKET_ENABLED: false});

        const development = await loadConfig({}, {NODE_ENV: "development"});
        expect(development.config).toMatchObject({CACHE_MAX_AGE: 0, HOT_RELOAD_ENABLED: true, WEBSOCKET_ENABLED: true});
    });

    it("reads PORT, REVALIDATE_API_KEY and CORS_ORIGINS from the environment", async () => {
        const {config} = await loadConfig({}, {
            PORT: "4000",
            REVALIDATE_API_KEY: "0123456789abcdef",
            CORS_ORIGINS: "https://a.example,https://b.example",
        });

        expect(config.PORT).toBe(4000);
        expect(config.REVALIDATE_API_KEY).toBe("0123456789abcdef");
        expect(config.CORS_ORIGINS).toEqual(["https://a.example", "https://b.example"]);
    });

    it("loads variables from .env files into process.env", async () => {
        const tree = createTree({".env": "FIXTURE_FROM_DOTENV=hello"});
        cleanup = tree.cleanup;
        const script = `await import(${JSON.stringify(configModule)}); console.log("__ENV__" + process.env.FIXTURE_FROM_DOTENV);`;
        const {stdout} = await runModule(script, tree.root, {NODE_ENV: ""});

        expect(stdout).toContain("__ENV__hello");
    });
});
