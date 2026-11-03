import {join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {readPages} from "../lib/helpers/readPages.js";
import {createTree} from "./support/tree.js";

describe("readPages", () => {
    let cleanup = () => {};
    afterEach(() => cleanup());

    it("maps every folder containing an index.tsx to a route, including nested and dynamic ones", () => {
        const tree = createTree({
            "pages/app.tsx": "",
            "pages/layout.tsx": "",
            "pages/home/index.tsx": "",
            "pages/partials/page1/index.tsx": "",
            "pages/partials/layout.tsx": "",
            "pages/blog/[slug]/index.tsx": "",
            "pages/guide/[category]/[article]/index.tsx": "",
        });
        cleanup = tree.cleanup;
        const pagesDir = join(tree.root, "pages");

        expect(readPages(pagesDir)).toEqual({
            home: join(pagesDir, "home/index.tsx"),
            "partials/page1": join(pagesDir, "partials/page1/index.tsx"),
            "blog/[slug]": join(pagesDir, "blog/[slug]/index.tsx"),
            "guide/[category]/[article]": join(pagesDir, "guide/[category]/[article]/index.tsx"),
        });
    });

    it("ignores loose .tsx files and folders without index.tsx", () => {
        const tree = createTree({
            "pages/about.tsx": "",
            "pages/components/Button.tsx": "",
            "pages/empty/.gitkeep": "",
        });
        cleanup = tree.cleanup;

        expect(readPages(join(tree.root, "pages"))).toEqual({});
    });

    it("registers a parent folder and its nested pages independently", () => {
        const tree = createTree({
            "pages/offers/index.tsx": "",
            "pages/offers/mobile/index.tsx": "",
        });
        cleanup = tree.cleanup;

        expect(Object.keys(readPages(join(tree.root, "pages"))).sort()).toEqual(["offers", "offers/mobile"]);
    });
});
