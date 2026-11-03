import {readFileSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {afterEach, describe, expect, it} from "vitest";
import {repoRoot} from "./support/app.js";
import {createTree, runModule} from "./support/tree.js";

const cacheModule = pathToFileURL(join(repoRoot, "lib/_build/helpers/cachePages.mjs")).href;

async function generate(root: string) {
    const script = `const m = await import(${JSON.stringify(cacheModule)}); console.log("__ENTRIES__" + JSON.stringify(m.loadCacheEntries(process.cwd())));`;
    const {stdout} = await runModule(script, root);
    const line = stdout.split("\n").find((l) => l.startsWith("__ENTRIES__"))!;
    return JSON.parse(line.slice("__ENTRIES__".length)) as Record<string, string>;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("page cache generation", () => {
    let cleanup = () => {};
    afterEach(() => cleanup());

    it("writes pagesCache, excludedFiles and stylesCache", async () => {
        const tree = createTree({
            "src/pages/home/index.tsx": "export default function Home() { return null; }",
            "src/pages/home/page.scss": "",
            "src/pages/legal/index.tsx": "// no scripts\nexport default function Legal() { return null; }",
        });
        cleanup = tree.cleanup;

        await generate(tree.root);
        const cacheDir = join(tree.root, "_build/cache");

        expect(Object.keys(readJson(join(cacheDir, "pagesCache.json"))).sort()).toEqual(["home", "legal"]);
        expect(readJson(join(cacheDir, "excludedFiles.json"))).toEqual(["legal"]);
        expect(readJson(join(cacheDir, "stylesCache.json"))).toEqual({home: [join(tree.root, "src/pages/home/page.scss")]});
    });

    // Known bug: generateExcludedFiles() deletes "no scripts" pages from the returned
    // entries. On a cold build (the CLI always deletes the cache), build-html therefore
    // never renders those pages: their .html is missing while Vite still emits their .js.
    it.fails("[BUG] returns 'no scripts' pages so their HTML is still generated", async () => {
        const tree = createTree({
            "src/pages/legal/index.tsx": "// no scripts\nexport default function Legal() { return null; }",
        });
        cleanup = tree.cleanup;

        expect(Object.keys(await generate(tree.root))).toContain("legal");
    });
});
