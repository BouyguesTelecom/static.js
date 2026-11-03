import {expect, type Page} from "@playwright/test";

/** Collects console errors, page errors and failed requests for a page. */
export function trackErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("response", (response) => {
        if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
    });
    return errors;
}

export function baseUrl(name: "STATICJS_START_URL" | "STATICJS_DEV_URL" | "STATICJS_HOST_URL" | "STATICJS_VITE_URL"): string {
    const url = process.env[name];
    if (!url) throw new Error(`${name} is not set; run the suite through playwright.config.ts`);
    return url;
}

export async function expectHydrated(page: Page, selector: string): Promise<void> {
    await expect(page.locator(selector)).toHaveAttribute("data-hydrated", "true");
}
