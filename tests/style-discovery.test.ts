import {join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {findStyleFiles, getStyleFilesRelative, hasStyles} from "../lib/helpers/styleDiscovery.js";
import {createTree} from "./support/tree.js";

describe("style discovery", () => {
    let cleanup = () => {};
    afterEach(() => cleanup());

    it("collects styles in cascade order: global -> layout -> page", () => {
        const tree = createTree({
            "src/pages/global.scss": "",
            "src/pages/layout.tsx": "",
            "src/pages/partials/layout.tsx": "",
            "src/pages/partials/layout.css": "",
            "src/pages/partials/page1/index.tsx": "",
            "src/pages/partials/page1/page.scss": "",
        });
        cleanup = tree.cleanup;
        const src = join(tree.root, "src");
        const page = join(src, "pages/partials/page1/index.tsx");

        expect(findStyleFiles(page, src)).toEqual([
            join(src, "pages/global.scss"),
            join(src, "pages/partials/layout.css"),
            join(src, "pages/partials/page1/page.scss"),
        ]);
        expect(getStyleFilesRelative(page, src, tree.root)).toEqual([
            "src/pages/global.scss",
            "src/pages/partials/layout.css",
            "src/pages/partials/page1/page.scss",
        ]);
    });

    it("prefers .scss over .css and falls back to style.* when page.* is missing", () => {
        const tree = createTree({
            "src/pages/home/index.tsx": "",
            "src/pages/home/style.scss": "",
            "src/pages/home/style.css": "",
        });
        cleanup = tree.cleanup;
        const src = join(tree.root, "src");

        expect(findStyleFiles(join(src, "pages/home/index.tsx"), src)).toEqual([join(src, "pages/home/style.scss")]);
    });

    it("reports pages without any style", () => {
        const tree = createTree({"src/pages/home/index.tsx": ""});
        cleanup = tree.cleanup;
        const src = join(tree.root, "src");

        expect(hasStyles(join(src, "pages/home/index.tsx"), src)).toBe(false);
    });
});
