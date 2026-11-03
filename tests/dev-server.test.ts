import {createHash} from "node:crypto";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {afterAll, beforeAll, describe, expect, inject, it} from "vitest";
import {cloneApp, type RunningServer, startStatic} from "./support/app.js";

const hashId = (prefix: string, pageName: string) =>
    `${prefix}-${createHash("sha256").update(`${prefix}-${pageName}`).digest("hex").slice(0, 10)}`;

const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1];

describe("SSR in development (`static dev`)", () => {
    let appDir: string;
    let server: RunningServer;
    const get = (path: string, init?: RequestInit) => fetch(`${server.url}${path}`, init);

    beforeAll(async () => {
        appDir = await cloneApp(inject("basicAppDir"), "ssr-dev", {withoutBuild: true});
        server = await startStatic(appDir, "dev");
    });

    afterAll(async () => {
        await server?.stop();
    });

    it("lists every page through /api/pages", async () => {
        const body = await (await get("/api/pages")).json();

        expect(body.success).toBe(true);
        expect(body.pages.map((page: { path: string }) => page.path)).toEqual(expect.arrayContaining([
            "/home", "/static-props", "/blog/[slug]", "/preview", "/no-js", "/caddy", "/partials/counter", "/partials/greeting",
        ]));
    });

    it("server-renders every page without error", async () => {
        const paths = ["/home", "/static-props", "/blog/first-post", "/preview", "/no-js", "/caddy", "/partials/counter", "/partials/greeting"];

        for (const path of paths) {
            const response = await get(path);
            const html = await response.text();
            expect(response.status, `${path}\n${server.logs()}`).toBe(200);
            expect(response.headers.get("content-type")).toContain("text/html");
            expect(html, path).toMatch(/<div id="app-[0-9a-f]{10}">/);
        }
        expect(server.logs()).not.toMatch(/Error rendering page|Error in renderPageRuntime/);
    });

    it("renders the same markup as the static build", async () => {
        const html = await (await get("/static-props")).text();
        const built = await readFile(join(inject("basicAppDir"), "_build/static-props.html"), "utf8");
        const body = (source: string) => source.match(/<body>[\s\S]*<\/main>/)?.[0];

        expect(body(html)).toBe(body(built));
    });

    it("resolves dynamic routes and passes params to getStaticProps", async () => {
        const html = await (await get("/blog/second-post")).text();

        expect(html).toContain("second-post");
        expect(html).toContain(`<div id="${hashId("app", "blog/slug")}">`);
        expect(html).toContain('src="/blog/slug.js"');
    });

    it("injects the hot reload client in development", async () => {
        expect(await (await get("/home")).text()).toContain('<script src="/hot-reload-client.js"></script>');
    });

    it("does not reference a page bundle for 'no scripts' pages", async () => {
        const html = await (await get("/no-js")).text();

        expect(html).toContain("Page without JavaScript");
        expect(html).not.toContain('type="module"');
    });

    it("runs getServerSideProps on every request with the incoming request", async () => {
        const first = await (await get("/preview", {headers: {"x-fixture": "from-test"}})).text();
        const second = await (await get("/preview")).text();
        const renderedAt = (html: string) => html.match(/data-testid="rendered-at">([^<]+)</)?.[1];

        expect(first).toContain('data-testid="header">from-test<');
        expect(renderedAt(first)).toBeDefined();
        expect(renderedAt(first)).not.toBe(renderedAt(second));
    });

    it("serves page bundles transformed by Vite with the hydration code", async () => {
        const response = await get("/home.js");
        const code = await response.text();

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("javascript");
        expect(code).toContain("hydrateRoot");
        expect(code).toContain(hashId("app", "home"));
    });

    it("compiles page styles on the fly", async () => {
        const response = await get("/home.css");

        expect(response.status).toBe(200);
        expect(await response.text()).toMatch(/\[data-testid="?home-title"?\]\s*\{\s*color:\s*rgb\(255, 0, 0\)/);
    });

    it("answers 404 for unknown pages", async () => {
        const response = await get("/does-not-exist");

        expect(response.status).toBe(404);
        expect((await response.json()).error).toBe("Not Found");
    });

    it("picks up page edits without restarting", async () => {
        const pagePath = join(appDir, "src/pages/home/index.tsx");
        const source = await readFile(pagePath, "utf8");
        await writeFile(pagePath, source.replace("Home page", "Home page edited"));

        await expect.poll(async () => (await get("/home")).text(), {timeout: 15_000, interval: 300})
            .toContain("Home page edited");
    });

    it("serves pages added while the server is running", async () => {
        await mkdir(join(appDir, "src/pages/added"), {recursive: true});
        await writeFile(join(appDir, "src/pages/added/index.tsx"),
            `import React from "react";\nexport default function Added() { return <p>Added later</p>; }\n`);

        await expect.poll(async () => (await get("/added")).text(), {timeout: 15_000, interval: 300})
            .toContain("Added later");
    });

    it("survives a page that throws during render", async () => {
        await mkdir(join(appDir, "src/pages/broken"), {recursive: true});
        await writeFile(join(appDir, "src/pages/broken/index.tsx"),
            `import React from "react";\nexport default function Broken(): React.JSX.Element { throw new Error("broken page"); }\n`);

        const response = await get("/broken");
        expect(response.status).not.toBe(200);
        expect((await get("/health")).status).toBe(200);
        expect((await get("/static-props")).status).toBe(200);
    });

    // Known bug: <Head> state is global, so concurrent SSR requests can leak titles
    // into each other (see create-page.test.tsx for the root cause).
    it.fails("[BUG] keeps <Head> isolated between concurrent requests", async () => {
        const titles = Array.from({length: 30}, (_, index) => `concurrent-${index}`);

        const pages = await Promise.all(titles.map((title) => get(`/preview?t=${title}`).then((r) => r.text())));

        pages.forEach((html, index) => expect(titleOf(html)).toBe(titles[index]));
    });
});
