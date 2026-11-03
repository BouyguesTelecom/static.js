import {join} from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {findClosestLayout, getLayoutIdentifier} from "../lib/helpers/layoutDiscovery.js";
import {createTree} from "./support/tree.js";

describe("findClosestLayout", () => {
    let cleanup = () => {};
    afterEach(() => cleanup());

    it("returns the nearest layout.tsx walking up from the page directory", () => {
        const tree = createTree({
            "src/pages/layout.tsx": "",
            "src/pages/partials/layout.tsx": "",
            "src/pages/partials/page1/index.tsx": "",
            "src/pages/partials/deep/page2/index.tsx": "",
        });
        cleanup = tree.cleanup;
        const src = join(tree.root, "src");

        expect(findClosestLayout(join(src, "pages/partials/page1/index.tsx"), src)).toBe(join(src, "pages/partials/layout.tsx"));
        expect(findClosestLayout(join(src, "pages/partials/deep/page2/index.tsx"), src)).toBe(join(src, "pages/partials/layout.tsx"));
    });

    it("prefers a layout placed next to the page", () => {
        const tree = createTree({
            "src/pages/layout.tsx": "",
            "src/pages/home/layout.tsx": "",
            "src/pages/home/index.tsx": "",
        });
        cleanup = tree.cleanup;
        const src = join(tree.root, "src");

        expect(findClosestLayout(join(src, "pages/home/index.tsx"), src)).toBe(join(src, "pages/home/layout.tsx"));
    });

    it("falls back to the root layout, then to null", () => {
        const withRoot = createTree({"src/pages/layout.tsx": "", "src/pages/home/index.tsx": ""});
        const src = join(withRoot.root, "src");
        expect(findClosestLayout(join(src, "pages/home/index.tsx"), src)).toBe(join(src, "pages/layout.tsx"));
        withRoot.cleanup();

        const withoutLayout = createTree({"src/pages/home/index.tsx": ""});
        cleanup = withoutLayout.cleanup;
        const src2 = join(withoutLayout.root, "src");
        expect(findClosestLayout(join(src2, "pages/home/index.tsx"), src2)).toBeNull();
    });

    it("builds a stable layout identifier", () => {
        expect(getLayoutIdentifier("/project/src/pages/partials/layout.tsx", "/project/src")).toBe("pages/partials/layout");
    });
});
