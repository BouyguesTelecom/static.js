import React from "react";
import {beforeEach, describe, expect, it} from "vitest";
import {collectHeadElement, injectHeadIntoHtml, resetHeadElements} from "../lib/components/HeadManager.js";

const baseHtml = `<html><head><title>Default</title><meta name="description" content="default"/></head><body></body></html>`;

describe("HeadManager", () => {
    beforeEach(() => resetHeadElements());

    it("returns the HTML untouched when no <Head> was rendered", () => {
        expect(injectHeadIntoHtml(baseHtml)).toBe(baseHtml);
    });

    it("replaces <title> and <meta name> and appends other elements before </head>", () => {
        collectHeadElement([
            <title key="t">New title</title>,
            <meta key="m" name="description" content="new description"/>,
            <link key="l" rel="canonical" href="https://example.com/"/>,
        ]);

        const html = injectHeadIntoHtml(baseHtml);

        expect(html).toContain("<title>New title</title>");
        expect(html).not.toContain("Default");
        expect(html).toContain('<meta name="description" content="new description"/>');
        expect(html).not.toContain('content="default"');
        expect(html).toContain('<link rel="canonical" href="https://example.com/"/></head>');
        expect(html.match(/<title>/g)).toHaveLength(1);
    });

    it("keeps the last <title> when several <Head> blocks are rendered", () => {
        collectHeadElement(<title>First</title>);
        collectHeadElement(<title>Second</title>);

        expect(injectHeadIntoHtml(baseHtml)).toContain("<title>Second</title>");
    });

    it("appends a <meta name> that does not exist in the layout", () => {
        collectHeadElement(<meta name="robots" content="noindex"/>);

        expect(injectHeadIntoHtml(baseHtml)).toContain('<meta name="robots" content="noindex"/></head>');
    });

    it("escapes the title content", () => {
        collectHeadElement(<title>{"<script>alert(1)</script>"}</title>);

        const html = injectHeadIntoHtml(baseHtml);
        expect(html).not.toContain("<script>alert(1)</script>");
        expect(html).toContain("&lt;script&gt;");
    });

    // Known bug: React.Children.forEach does not traverse fragments, so
    // <Head><>...</></Head> appends a second <title> instead of replacing it.
    it.fails("[BUG] supports children wrapped in a fragment", () => {
        collectHeadElement(<><title>From fragment</title></>);

        const html = injectHeadIntoHtml(baseHtml);
        expect(html.match(/<title>/g)).toHaveLength(1);
        expect(html).toContain("<title>From fragment</title>");
    });

    it("clears collected elements on reset", () => {
        collectHeadElement(<title>Stale</title>);
        resetHeadElements();

        expect(injectHeadIntoHtml(baseHtml)).toBe(baseHtml);
    });
});
