import {readFile, stat} from "node:fs/promises";
import {join} from "node:path";
import {afterAll, beforeAll, describe, expect, inject, it} from "vitest";
import {cloneApp, type RunningServer, startStatic} from "./support/app.js";

const API_KEY = "test-revalidate-key-0123456789";

describe("production server (`static start`)", () => {
    let appDir: string;
    let server: RunningServer;
    const get = (path: string, init?: RequestInit) => fetch(`${server.url}${path}`, init);

    beforeAll(async () => {
        appDir = await cloneApp(inject("basicAppDir"), "server-prod", {
            keepCache: true,
            config: {
                DECODE_TEMPLATE_EXPRESSIONS: true,
                RATE_LIMIT_MAX: 1000,
                REVALIDATE_RATE_LIMIT_MAX: 100,
                REVALIDATE_API_KEY: API_KEY,
                CORS_ORIGINS: ["https://allowed.example"],
                CSP_DIRECTIVES: {scriptSrc: ["https://cdn.example.com"], connectSrc: ["https://api.example.com"]},
            },
        });
        server = await startStatic(appDir, "start");
    });

    afterAll(async () => {
        await server?.stop();
    });

    describe("static pages", () => {
        it("serves pre-built HTML with clean URLs", async () => {
            for (const [path, file] of [["/home", "home.html"], ["/blog/first-post", "blog/first-post.html"], ["/partials/counter", "partials/counter.html"]]) {
                const response = await get(path);
                expect(response.status, path).toBe(200);
                expect(await response.text()).toBe(await readFile(join(appDir, "_build", file), "utf8"));
            }
        });

        it("serves page bundles, chunks and styles", async () => {
            const html = await (await get("/home")).text();
            const js = await get("/home.js");
            const chunk = (await js.text()).match(/"\.\/(assets\/vendor-[^"]+\.js)"/)?.[1];

            expect(html).toContain('src="/home.js"');
            expect(js.status).toBe(200);
            expect(chunk).toBeDefined();
            expect((await get(`/${chunk}`)).status).toBe(200);
            expect((await get("/home.css")).headers.get("content-type")).toContain("text/css");
        });

        it("sets cache headers for HTML and assets", async () => {
            expect((await get("/home")).headers.get("cache-control")).toBe("public, max-age=3600");
            expect((await get("/home.js")).headers.get("cache-control")).toBe("public, max-age=86400");
        });

        it("answers 404 JSON for unknown pages", async () => {
            const response = await get("/does-not-exist");

            expect(response.status).toBe(404);
            expect(await response.json()).toMatchObject({success: false, error: "Not Found"});
        });

        it("lists built pages through /api/pages", async () => {
            const body = await (await get("/api/pages")).json();

            expect(body.mode).toContain("production");
            expect(body.pages.map((page: { path: string }) => page.path)).toEqual(expect.arrayContaining(["/home", "/blog/first-post"]));
        });

        // Known issue: _build/cache/*.json is served publicly and discloses absolute
        // server paths (e.g. /home/app/src/pages/...). Caddy serving _build has the same issue.
        it.fails("[BUG] does not expose the internal build cache", async () => {
            const response = await get("/cache/pagesCache.json");

            expect(response.status).toBe(404);
        });
    });

    describe("SSR of getServerSideProps pages (preview)", () => {
        it("renders on every request and forwards the request", async () => {
            const first = await (await get("/preview", {headers: {"x-fixture": "prod"}})).text();
            const second = await (await get("/preview")).text();
            const renderedAt = (html: string) => html.match(/data-testid="rendered-at">([^<]+)</)?.[1];

            expect(first).toContain('data-testid="header">prod<');
            expect(renderedAt(first)).not.toBe(renderedAt(second));
            expect(first).toContain('src="/preview.js"');
        });

        it("disables caching for server-rendered pages", async () => {
            expect((await get("/preview")).headers.get("cache-control")).toBe("no-cache, no-store, must-revalidate");
        });
    });

    describe("security", () => {
        it("sends security headers and merges CSP_DIRECTIVES with the defaults", async () => {
            const headers = (await get("/home")).headers;
            const csp = headers.get("content-security-policy") ?? "";

            expect(csp).toContain("default-src 'self'");
            expect(csp).toMatch(/script-src 'self' https:\/\/cdn\.example\.com/);
            expect(csp).toContain("connect-src https://api.example.com");
            expect(csp).toContain("style-src 'self' 'unsafe-inline' https://assets.bouyguestelecom.fr");
            expect(headers.get("x-content-type-options")).toBe("nosniff");
            expect(headers.get("x-frame-options")).toBe("SAMEORIGIN");
            expect(headers.get("x-powered-by")).toBeNull();
        });

        it("only allows configured CORS origins", async () => {
            const allowed = await get("/home.js", {headers: {Origin: "https://allowed.example"}});
            const denied = await get("/home.js", {headers: {Origin: "https://evil.example"}});

            expect(allowed.headers.get("access-control-allow-origin")).toBe("https://allowed.example");
            expect(denied.headers.get("access-control-allow-origin")).toBeNull();
        });

        it("rejects revalidation without a valid API key", async () => {
            const withoutKey = await get("/revalidate", {method: "POST"});
            const wrongKey = await get("/revalidate", {method: "POST", headers: {"X-API-Key": "x".repeat(API_KEY.length)}});

            expect(withoutKey.status).toBe(401);
            expect(wrongKey.status).toBe(403);
        });

        it("rebuilds only the requested page on authorised revalidation", async () => {
            const target = join(appDir, "_build/static-props.html");
            const untouched = join(appDir, "_build/home.html");
            const before = {target: (await stat(target)).mtimeMs, untouched: (await stat(untouched)).mtimeMs};

            const response = await get("/revalidate", {
                method: "POST",
                headers: {"Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json"},
                body: JSON.stringify({paths: ["/static-props"]}),
            });

            expect(response.status, await response.clone().text()).toBe(200);
            expect(await response.text()).toContain("static-props");
            expect((await stat(target)).mtimeMs).toBeGreaterThan(before.target);
            expect((await stat(untouched)).mtimeMs).toBe(before.untouched);
            expect(await readFile(target, "utf8")).toContain("Hello from getStaticProps");
        });
    });
});

// Deployed without _build/cache (e.g. excluded from the Docker image) and with default settings.
describe("production server defaults", () => {
    let server: RunningServer;

    beforeAll(async () => {
        const appDir = await cloneApp(inject("basicAppDir"), "server-defaults", {config: {RATE_LIMIT_MAX: 30}});
        server = await startStatic(appDir, "start");
    });

    afterAll(async () => {
        await server?.stop();
    });

    // Known bug: without _build/cache/excludedFiles.json, renderPageRuntime falls back to `{}`
    // and crashes on `.includes`, so getServerSideProps pages answer 404 in production.
    it.fails("[BUG] renders getServerSideProps pages even when _build/cache is absent", async () => {
        const response = await fetch(`${server.url}/preview`);

        expect(response.status).toBe(200);
    });

    it("refuses revalidation when no API key is configured", async () => {
        const response = await fetch(`${server.url}/revalidate`, {method: "POST"});

        expect(response.status).toBe(503);
    });

    it("rate-limits per client IP, using X-Forwarded-For behind one proxy", async () => {
        const hit = (ip: string) => fetch(`${server.url}/home`, {headers: {"X-Forwarded-For": ip}});
        const statuses: number[] = [];
        for (let i = 0; i < 31; i++) statuses.push((await hit("203.0.113.1")).status);

        expect(statuses).toContain(429);
        expect((await hit("203.0.113.2")).status).toBe(200);
    });
});
