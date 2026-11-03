import React from "react";
import {describe, expect, it} from "vitest";
import {createPage} from "../lib/helpers/createPage.js";
import {Head} from "../lib/components/Head.js";

type AnyProps = Record<string, unknown>;

const FullLayoutApp = ({Component, props}: { Component: React.FC<AnyProps>; props: AnyProps }) => (
    <html lang="fr">
    <head><title>Layout title</title></head>
    <body><Component {...props}/></body>
    </html>
);

const FragmentApp = ({Component, props}: { Component: React.FC<AnyProps>; props: AnyProps }) => (
    <div data-layout="partials"><Component {...props}/></div>
);

function render(options: Partial<Parameters<typeof createPage>[0]> & { PageComponent: React.FC<any> }) {
    return createPage({
        data: undefined,
        AppComponent: FullLayoutApp as never,
        initialDatasId: "abc123",
        rootId: "root42",
        pageName: "home",
        JSfileName: "home",
        returnHtml: true,
        ...options,
    } as Parameters<typeof createPage>[0]) as Promise<string>;
}

describe("createPage", () => {
    it("wraps the page in the hydration root and references the page script", async () => {
        const html = await render({PageComponent: () => <h1>Hello</h1>});

        expect(html).toContain('<div id="app-root42"><h1>Hello</h1></div>');
        expect(html).toContain('<script type="module" src="/home.js"></script>');
        expect(html).not.toContain("initial-data-");
    });

    it("serialises initial data and neutralises </script> injection", async () => {
        const html = await render({
            data: {title: "</script><script>alert(1)</script>"},
            PageComponent: ({data}: { data: { title: string } }) => <p>{data.title}</p>,
        });

        expect(html).toContain('<script id=initial-data-abc123 type="application/json">');
        expect(html).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
        expect(html.match(/<script>alert\(1\)<\/script>/g)).toBeNull();
    });

    it("omits the script tag when JavaScript is disabled for the page", async () => {
        const html = await render({JSfileName: false, PageComponent: () => <p>static</p>});

        expect(html).not.toContain('type="module"');
    });

    it("uses the dynamic route script path (params replaced by their name)", async () => {
        const html = await render({pageName: "blog/first-post", JSfileName: "blog/slug", PageComponent: () => <p/>});

        expect(html).toContain('src="/blog/slug.js"');
    });

    it("injects the CSS link in <head> for full layouts", async () => {
        const html = await render({CSSfileName: "home", PageComponent: () => <p/>});

        expect(html).toContain('<link rel="stylesheet" href="/home.css"></head>');
    });

    it("prepends the CSS link for fragments without <head>/<body>", async () => {
        const html = await render({
            AppComponent: FragmentApp as never,
            pageName: "partials/page1",
            JSfileName: "partials/page1",
            CSSfileName: "partials/page1",
            PageComponent: () => <p>fragment</p>,
        });

        expect(html.startsWith('<link rel="stylesheet" href="/partials/page1.css"><div data-layout="partials">')).toBe(true);
        expect(html).not.toContain("<html");
    });

    it("merges <Head> elements into the layout head", async () => {
        const html = await render({
            PageComponent: () => (
                <>
                    <Head><title>Page title</title></Head>
                    <p>content</p>
                </>
            ),
        });

        expect(html).toContain("<title>Page title</title>");
        expect(html).not.toContain("Layout title");
    });

    it("resolves Suspense boundaries before returning the HTML", async () => {
        let resolved = false;
        const promise = new Promise<string>((resolve) => setTimeout(() => {
            resolved = true;
            resolve("async content");
        }, 20));
        const Async = () => <p>{React.use(promise)}</p>;

        const html = await render({
            PageComponent: () => (
                <React.Suspense fallback={<p>loading</p>}>
                    <Async/>
                </React.Suspense>
            ),
        });

        expect(resolved).toBe(true);
        expect(html).toContain("async content");
        expect(html).not.toContain("loading");
    });

    it("rejects when the page throws during render", async () => {
        const Broken = () => {
            throw new Error("boom");
        };

        await expect(render({PageComponent: Broken})).rejects.toThrow("boom");
    });

    // Known bug: <Head> elements are collected in a global array. In the runtime server
    // (dev mode and production getServerSideProps pages) requests are rendered concurrently,
    // so one page can receive the <title> of another request. a8e174e only serialised the build.
    it.fails("[BUG] keeps <Head> isolated between concurrent renders (SSR requests)", async () => {
        const titles = Array.from({length: 20}, (_, index) => `Title ${index}`);
        const delays = new Map(titles.map((title) => [title, new Promise<void>((resolve) => setTimeout(resolve, Math.random() * 20))]));
        const Slow = ({title}: { title: string }) => {
            React.use(delays.get(title)!);
            return <p>{title}</p>;
        };

        const results = await Promise.all(
            titles.map((title) =>
                render({
                    PageComponent: () => (
                        <>
                            <Head><title>{title}</title></Head>
                            <React.Suspense fallback={null}><Slow title={title}/></React.Suspense>
                        </>
                    ),
                }),
            ),
        );

        results.forEach((html, index) => {
            expect(html).toContain(`<title>${titles[index]}</title>`);
        });
    });
});
