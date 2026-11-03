import {expect, test} from "@playwright/test";
import {baseUrl, trackErrors} from "./support/browser.js";

const servers = [
    {name: "static start", env: "STATICJS_START_URL"},
    {name: "static dev", env: "STATICJS_DEV_URL"},
] as const;

for (const server of servers) {
    test.describe(`pages served by ${server.name}`, () => {
        let errors: string[];

        test.beforeEach(async ({page}) => {
            errors = trackErrors(page);
        });

        test.afterEach(() => {
            // Covers hydration mismatches (React logs them as console errors) and missing assets.
            expect(errors).toEqual([]);
        });

        test("hydrates the home page and handles clicks", async ({page}) => {
            await page.goto(`${baseUrl(server.env)}/home`);

            await expect(page.getByTestId("hydrated")).toHaveText("hydrated");
            await page.getByTestId("counter").click();
            await page.getByTestId("counter").click();
            await expect(page.getByTestId("counter")).toHaveText("Count: 2");
        });

        test("applies <Head> title and meta, and the page stylesheet", async ({page}) => {
            await page.goto(`${baseUrl(server.env)}/home`);

            await expect(page).toHaveTitle("Home title from Head");
            await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "Home description from Head");
            await expect(page.getByTestId("home-title")).toHaveCSS("color", "rgb(255, 0, 0)");
        });

        test("hydrates getStaticProps data without executing injected markup", async ({page}) => {
            await page.goto(`${baseUrl(server.env)}/static-props`);
            await page.waitForLoadState("networkidle");

            await expect(page.getByTestId("message")).toHaveText("Hello from getStaticProps");
            await expect(page.getByTestId("unsafe")).toHaveText("</script><script>window.__xss = true</script>");
            expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeUndefined();
        });

        test("renders every getStaticPaths route", async ({page}) => {
            for (const slug of ["first-post", "second-post"]) {
                await page.goto(`${baseUrl(server.env)}/blog/${slug}`);
                await expect(page.getByTestId("slug")).toHaveText(`Post: ${slug}`);
            }
        });

        test("hydrates getServerSideProps pages with the server data", async ({page}) => {
            await page.setExtraHTTPHeaders({"x-fixture": "from-browser"});
            await page.goto(`${baseUrl(server.env)}/preview?t=Browser%20title`);
            const renderedAt = await page.getByTestId("rendered-at").textContent();
            await page.waitForLoadState("networkidle");

            await expect(page).toHaveTitle("Browser title");
            await expect(page.getByTestId("header")).toHaveText("from-browser");
            // Hydration must reuse the server props instead of recomputing them.
            await expect(page.getByTestId("rendered-at")).toHaveText(renderedAt!);
        });
    });
}
