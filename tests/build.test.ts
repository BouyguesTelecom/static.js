import {createHash} from "node:crypto";
import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {dirname, join, relative, resolve} from "node:path";
import {gzipSync} from "node:zlib";
import {beforeAll, describe, expect, inject, it} from "vitest";
import {buildApp, cloneApp} from "./support/app.js";

const hashId = (prefix: string, pageName: string) =>
    `${prefix}-${createHash("sha256").update(`${prefix}-${pageName}`).digest("hex").slice(0, 10)}`;

function listFiles(dir: string, base = dir): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
        const fullPath = join(dir, entry.name);
        return entry.isDirectory() ? listFiles(fullPath, base) : [relative(base, fullPath)];
    });
}

/** Gzipped size of a page entry and every chunk it statically imports. */
function shippedJs(buildDir: string, entry: string): { bytes: number; files: string[]; code: string } {
    const seen = new Set<string>();
    let bytes = 0;
    let code = "";
    const visit = (file: string) => {
        if (seen.has(file)) return;
        seen.add(file);
        const content = readFileSync(file, "utf8");
        bytes += gzipSync(content).length;
        code += content;
        for (const match of content.matchAll(/(?:from|import)\s*["'](\.{1,2}\/[^"']+\.js)["']/g)) {
            visit(resolve(dirname(file), match[1]));
        }
    };
    visit(join(buildDir, entry));
    return {bytes, files: [...seen].map((file) => relative(buildDir, file)), code};
}

describe("static build output", () => {
    const appDir = inject("basicAppDir");
    const buildDir = join(appDir, "_build");
    const read = (file: string) => readFileSync(join(buildDir, file), "utf8");

    it("generates one HTML file per static page and per getStaticPaths entry", () => {
        const html = listFiles(buildDir).filter((file) => file.endsWith(".html")).sort();

        expect(html).toEqual(expect.arrayContaining([
            "blog/first-post.html",
            "blog/second-post.html",
            "caddy.html",
            "home.html",
            "partials/counter.html",
            "partials/greeting.html",
            "static-props.html",
        ]));
    });

    it("does not pre-render getServerSideProps pages", () => {
        expect(existsSync(join(buildDir, "preview.html"))).toBe(false);
    });

    it("uses the same hydration ids in the HTML and in the page bundle", () => {
        for (const [pageName, htmlFile, jsFile] of [
            ["home", "home.html", "home.js"],
            ["partials/counter", "partials/counter.html", "partials/counter.js"],
            ["blog/slug", "blog/first-post.html", "blog/slug.js"],
        ]) {
            const rootId = hashId("app", pageName);
            expect(read(htmlFile)).toContain(`<div id="${rootId}">`);
            expect(read(jsFile)).toContain(rootId);
            expect(read(jsFile)).toContain(hashId("initial-data", pageName));
        }
    });

    it("references the page script and serialises getStaticProps data", () => {
        const html = read("static-props.html");

        expect(html).toContain('<script type="module" src="/static-props.js"></script>');
        expect(html).toContain(`<script id=${hashId("initial-data", "static-props")} type="application/json">`);
        expect(html).toContain("Hello from getStaticProps");
    });

    it("escapes user data in markup and in the JSON payload", () => {
        const html = read("static-props.html");

        expect(html).not.toContain("<script>window.__xss = true</script>");
        expect(html).toContain("\\u003cscript>window.__xss = true\\u003c/script>");
    });

    it("renders one HTML file per dynamic path with its own data", () => {
        expect(read("blog/first-post.html")).toContain('{"slug":"first-post"}');
        expect(read("blog/second-post.html")).toContain('{"slug":"second-post"}');
        expect(read("blog/second-post.html")).toContain('src="/blog/slug.js"');
    });

    it("applies <Head> overrides over the layout and data.json values", () => {
        const html = read("home.html");

        expect(html).toContain("<title>Home title from Head</title>");
        expect(html).toContain('<meta name="description" content="Home description from Head"/>');
        expect(html.match(/<title>/g)).toHaveLength(1);
        expect(html.match(/name="description"/g)).toHaveLength(1);
    });

    it("compiles SCSS and links the stylesheet in <head>", () => {
        expect(read("home.css")).toMatch(/\[data-testid=home-title\]\{color:red\}/);
        expect(read("home.html")).toContain('<link rel="stylesheet" href="/home.css"></head>');
    });

    it("renders partials as fragments without <html> wrapper", () => {
        const html = read("partials/counter.html");

        expect(html.startsWith('<div data-layout="partials">')).toBe(true);
        expect(html).not.toMatch(/<html|<head|<body/);
        expect(html).toContain('src="/partials/counter.js"');
    });

    it("keeps Go/Caddy template expressions raw when DECODE_TEMPLATE_EXPRESSIONS is on", () => {
        const html = read("caddy.html");

        expect(html).toContain('{{ .Req.Header.Get "X-Name" }}');
        expect(html).toContain('{{ include "/fragment.html" }}');
        expect(html).toContain('data-server-only=""');
        expect(html).toContain('data-server-element=""');
        // Text outside {{ }} stays HTML-encoded.
        expect(html).toContain("&quot;quoted&quot; &amp; &lt;tag&gt;");
    });

    // Known bug: on a cold build (`static build` always deletes the cache) pages starting
    // with "// no scripts" are dropped from the HTML build, while Vite still emits their JS.
    it.fails("[BUG] renders 'no scripts' pages as HTML without a script tag", () => {
        expect(existsSync(join(buildDir, "no-js.html"))).toBe(true);
        expect(read("no-js.html")).not.toContain('type="module"');
    });

    it("keeps a fragment's JavaScript under a reasonable budget (< 70 kB gzip)", () => {
        const {bytes, code} = shippedJs(buildDir, "partials/counter.js");

        expect(code).toContain("hydrateRoot");
        expect(bytes).toBeLessThan(70 * 1024);
    });

    // Known bug: HeadManager imports react-dom/server, so every page using <Head>
    // ships React's server renderer to the browser (~+58 kB gzip).
    it.fails("[BUG] does not ship react-dom/server to the browser for pages using <Head>", () => {
        const {bytes, code} = shippedJs(buildDir, "home.js");

        expect(code).not.toMatch(/renderToPipeableStream|renderToStaticMarkup/);
        expect(bytes).toBeLessThan(70 * 1024);
    });
});

describe("build variants", () => {
    const appDir = inject("basicAppDir");

    it("is reproducible: building elsewhere yields byte-identical HTML, JS and CSS", async () => {
        const clone = await cloneApp(appDir, "build-reproducible", {withoutBuild: true});
        await buildApp(clone);

        const publicFiles = (dir: string) => listFiles(dir).filter((file) => !file.startsWith("cache/")).sort();
        const original = publicFiles(join(appDir, "_build"));
        expect(publicFiles(join(clone, "_build"))).toEqual(original);
        for (const file of original) {
            expect(readFileSync(join(clone, "_build", file), "utf8"), file).toBe(readFileSync(join(appDir, "_build", file), "utf8"));
        }
    });

    it("prefixes scripts, styles and chunks with BASE_PATH", async () => {
        const clone = await cloneApp(appDir, "build-base-path", {
            withoutBuild: true,
            config: {BASE_PATH: "/statics/", DECODE_TEMPLATE_EXPRESSIONS: true},
        });
        await buildApp(clone);
        const read = (file: string) => readFileSync(join(clone, "_build", file), "utf8");

        expect(read("home.html")).toContain('src="/statics/home.js"');
        expect(read("home.html")).toContain('href="/statics/home.css"');
        expect(read("partials/counter.html")).toContain('src="/statics/partials/counter.js"');
        // Entries import chunks relatively so they work under any mount point.
        expect(read("home.js")).toMatch(/from\s*"\.\/assets\/vendor-/);
    });

    it("lets `static build` run twice in a row (stale cache is cleared)", async () => {
        const clone = await cloneApp(appDir, "build-twice");
        const before = statSync(join(clone, "_build/home.html")).mtimeMs;

        await buildApp(clone);

        expect(statSync(join(clone, "_build/home.html")).mtimeMs).toBeGreaterThan(before);
    });
});
