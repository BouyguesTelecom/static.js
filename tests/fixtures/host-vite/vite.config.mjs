// Vite host application consuming StaticJS fragments built by other apps.
// Intentionally does not import "vite" so it can run with any installed Vite binary.
import {readFileSync} from "node:fs";
import {join} from "node:path";

/** Maps URL prefixes ("/app1") to StaticJS `_build` directories. */
const fragmentBuilds = JSON.parse(process.env.STATICJS_FRAGMENT_BUILDS ?? "{}");
const hostUrl = process.env.STATICJS_HOST_URL;

/**
 * Build-time include: `<!-- staticjs:include /app1/partials/counter.html -->` is replaced by the
 * fragment HTML. Runs after Vite's own HTML processing so the fragment scripts stay untouched
 * and are loaded at runtime from the StaticJS app.
 */
function staticjsFragments() {
    return {
        name: "staticjs-fragments",
        transformIndexHtml: {
            order: "post",
            handler(html) {
                return html.replace(/<!--\s*staticjs:include\s+(\S+)\s*-->/g, (_, path) => {
                    const prefix = Object.keys(fragmentBuilds).find((p) => path.startsWith(`${p}/`));
                    if (!prefix) throw new Error(`No StaticJS build mounted for ${path}`);
                    return readFileSync(join(fragmentBuilds[prefix], path.slice(prefix.length)), "utf8");
                });
            },
        },
    };
}

const proxy = hostUrl ? Object.fromEntries(Object.keys(fragmentBuilds).map((p) => [p, hostUrl])) : {};

export default {
    plugins: [staticjsFragments()],
    build: {
        rollupOptions: {
            input: {
                index: "index.html",
                client: "client.html",
            },
        },
    },
    preview: {proxy},
    server: {proxy},
};
