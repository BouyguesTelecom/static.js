import React from "react";
import {renderToString} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {ServerElement, ServerOnly} from "../lib/components/ServerOnly.js";

describe("ServerOnly / ServerElement (server render)", () => {
    it("renders template expressions verbatim inside a data-server-only wrapper", () => {
        const html = renderToString(
            <p>Hello <ServerOnly>{"{{ $forename }}"}</ServerOnly>!</p>,
        );

        expect(html).toMatch(/<span[^>]*data-server-only=""[^>]*>\{\{ \$forename \}\}<\/span>/);
    });

    it("supports a div wrapper, a class name and a stable id", () => {
        const html = renderToString(<ServerOnly as="div" className="user" id="user-name">{"{{ .User }}"}</ServerOnly>);

        expect(html).toContain('id="user-name"');
        expect(html).toContain('class="user"');
        expect(html).toMatch(/^<div/);
    });

    it("renders ServerElement attributes and content with template expressions", () => {
        const html = renderToString(
            <ServerElement as="button" id="cta" serverProps={{"aria-label": "{{ $label }}"}} type="button">
                {"{{ $label }}"}
            </ServerElement>,
        );

        expect(html).toMatch(/^<button/);
        expect(html).toContain('id="cta"');
        expect(html).toContain('aria-label="{{ $label }}"');
        expect(html).toContain('data-server-element=""');
        expect(html).toContain("{{ $label }}");
    });
});
