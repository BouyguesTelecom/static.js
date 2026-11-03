import {expect, test} from "@playwright/test";
import {baseUrl, expectHydrated, trackErrors} from "./support/browser.js";

/**
 * StaticJS fragments (`_build/partials/*.html` + their JS) consumed by host applications:
 *  - a plain HTML site rendered by a Caddy-like server (`{{ include }}` at request time)
 *  - a Vite application (fragments inlined at build time, or fetched at runtime)
 * app1 and app2 are two builds of the fixture app, mounted under BASE_PATH /app1 and /app2.
 */

let errors: string[];

test.beforeEach(async ({page}) => {
    errors = trackErrors(page);
});

test.describe("plain HTML host (Caddy templates)", () => {
    test("hydrates a fragment included from another app", async ({page}) => {
        await page.goto(`${baseUrl("STATICJS_HOST_URL")}/single.html`);

        await expectHydrated(page, '[data-testid="fragment"]');
        await expect(page.getByTestId("host-header")).toHaveText("Plain HTML host");
        await page.getByTestId("fragment-counter").click();
        await expect(page.getByTestId("fragment-counter")).toHaveText("app1: 1");
        expect(errors).toEqual([]);
    });

    test("hydrates fragments of two apps on the same page", async ({page}) => {
        await page.goto(`${baseUrl("STATICJS_HOST_URL")}/multi.html`);

        await expectHydrated(page, '[data-testid="fragment"]');
        await expectHydrated(page, '[data-testid="greeting-fragment"]');
        await page.getByTestId("fragment-counter").click();
        await page.getByTestId("greeting-toggle").click();
        await expect(page.getByTestId("fragment-counter")).toHaveText("app1: 1");
        await expect(page.getByTestId("greeting-toggle")).toHaveText("app2: open");
        expect(errors).toEqual([]);
    });

    // Known bug: the hydration root id is a hash of the page name only, so the same page
    // name in two apps produces the same id: app2's script hydrates app1's DOM node and
    // app2's fragment stays inert.
    test("[BUG] hydrates the same page name coming from two apps", async ({page}) => {
        test.fail();
        await page.goto(`${baseUrl("STATICJS_HOST_URL")}/collision.html`);
        const app1 = page.locator("#slot-app1 [data-testid=fragment]");
        const app2 = page.locator("#slot-app2 [data-testid=fragment]");

        await expect(app1).toHaveAttribute("data-hydrated", "true", {timeout: 5_000});
        await expect(app2).toHaveAttribute("data-hydrated", "true", {timeout: 5_000});
        await app1.getByRole("button").click();
        await app2.getByRole("button").click();
        await expect(app1.getByRole("button")).toHaveText("app1: 1");
        await expect(app2.getByRole("button")).toHaveText("app2: 1");
        expect(errors).toEqual([]);
    });

    test("keeps Caddy-rendered ServerOnly/ServerElement content after hydration", async ({page}) => {
        await page.setExtraHTTPHeaders({"X-Name": "Jean"});
        await page.goto(`${baseUrl("STATICJS_HOST_URL")}/caddy.html`);
        await page.waitForLoadState("networkidle");

        await expect(page.getByTestId("greeting")).toHaveText("Hello Jean!");
        await expect(page.locator("#caddy-title")).toHaveText("Included by the host");
        await expect(page.getByTestId("escaped")).toHaveText('"quoted" & <tag>');
        expect(errors).toEqual([]);
    });
});

test.describe("Vite host", () => {
    test("hydrates fragments inlined at build time next to the host's own bundle", async ({page}) => {
        await page.goto(`${baseUrl("STATICJS_VITE_URL")}/`);

        await expect(page.getByTestId("host-status")).toHaveText("vite-host-ready");
        await expectHydrated(page, '[data-testid="fragment"]');
        await expectHydrated(page, '[data-testid="greeting-fragment"]');
        await page.getByTestId("fragment-counter").click();
        await expect(page.getByTestId("fragment-counter")).toHaveText("app1: 1");
        expect(errors).toEqual([]);
    });

    // Known bug: the generated entry hydrates inside a DOMContentLoaded listener, so a
    // fragment injected after page load (fetch + insert) is displayed but never hydrated.
    test("[BUG] hydrates a fragment fetched and injected at runtime", async ({page}) => {
        test.fail();
        await page.goto(`${baseUrl("STATICJS_VITE_URL")}/client.html`);

        await expect(page.getByTestId("host-status")).toHaveText("fragment-injected");
        await expect(page.getByTestId("greeting-toggle")).toHaveText("app2: closed");
        await expectHydrated(page, '[data-testid="greeting-fragment"]');
    });
});
