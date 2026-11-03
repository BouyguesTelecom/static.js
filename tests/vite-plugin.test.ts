import {createHash} from "node:crypto";
import {join} from "node:path";
import {afterEach, describe, expect, it, vi} from "vitest";
import {addHydrationCodePlugin} from "../lib/server/config/vite.plugin.js";
import {createTree} from "./support/tree.js";

const expectedId = (prefix: string, pageName: string) =>
    `${prefix}-${createHash("sha256").update(`${prefix}-${pageName}`).digest("hex").slice(0, 10)}`;

describe("addHydrationCodePlugin", () => {
    let cleanup = () => {};
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    function setup(pageName: string, pagePath: string) {
        const tree = createTree({
            "src/pages/app.tsx": "",
            "src/pages/layout.tsx": "",
            [pagePath]: "",
        });
        cleanup = tree.cleanup;
        vi.spyOn(process, "cwd").mockReturnValue(tree.root);
        const id = join(tree.root, pagePath);
        const plugin = addHydrationCodePlugin({[pageName]: id});
        return {plugin, id};
    }

    it("appends hydration code using the same ids as the generated HTML", () => {
        const {plugin, id} = setup("partials/page1", "src/pages/partials/page1/index.tsx");

        const result = plugin.transform("export default function Page1() { return null; }", id);

        expect(result).not.toBeNull();
        expect(result!.code).toContain("import ReactDOM from 'react-dom/client';");
        expect(result!.code).toContain('import { App } from "../../app";');
        expect(result!.code).toContain(`export const rootId = '${expectedId("app", "partials/page1")}';`);
        expect(result!.code).toContain(`export const initialDatasId = '${expectedId("initial-data", "partials/page1")}';`);
        expect(result!.code).toContain("Component: Page1");
    });

    it("hashes dynamic routes with the parameter name, like the HTML build", () => {
        const {plugin, id} = setup("blog/[slug]", "src/pages/blog/[slug]/index.tsx");

        const result = plugin.transform("const Post = () => null;\nexport default Post;", id);

        expect(result!.code).toContain(`'${expectedId("app", "blog/slug")}'`);
        expect(result!.code).toContain("Component: Post");
    });

    it("ignores modules that are not page entries", () => {
        const {plugin} = setup("home", "src/pages/home/index.tsx");

        expect(plugin.transform("export default function X() {}", "/somewhere/else.tsx")).toBeNull();
    });

    // Known limitation: the component name is extracted with a regex, so an anonymous
    // default export produces `Component: function`, which is invalid JavaScript.
    it.fails("[BUG] supports anonymous default exported functions", () => {
        const {plugin, id} = setup("home", "src/pages/home/index.tsx");

        const result = plugin.transform("export default function () { return null; }", id);

        expect(result).not.toBeNull();
        expect(result!.code).not.toContain("Component: function");
    });
});
