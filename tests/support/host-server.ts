import {existsSync, statSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {createServer, type IncomingMessage, type Server} from "node:http";
import {extname, join, normalize, sep} from "node:path";

/**
 * Minimal stand-in for the Caddy setup used in production: static mounts plus
 * the two Go template actions StaticJS pages rely on:
 *   {{ include "/path" }}            → rendered content of another file (recursively)
 *   {{ .Req.Header.Get "X-Header" }} → request header value
 * Any other `{{ ... }}` left in an HTML response is treated as a template error (500),
 * like Caddy does when a template cannot be parsed (e.g. HTML-encoded quotes).
 */

export interface Mount {
    /** URL prefix, e.g. "/app1" or "/". */
    prefix: string;
    /** Directories searched in order. */
    dirs: string[];
}

export interface HostServer {
    url: string;
    close: () => Promise<void>;
}

const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
};

class TemplateError extends Error {}

function resolveFile(mounts: Mount[], urlPath: string): string | undefined {
    const sorted = [...mounts].sort((a, b) => b.prefix.length - a.prefix.length);
    for (const mount of sorted) {
        const prefix = mount.prefix.replace(/\/$/, "");
        if (urlPath !== prefix && !urlPath.startsWith(`${prefix}/`)) continue;
        const relative = decodeURIComponent(urlPath.slice(prefix.length)) || "/";
        for (const dir of mount.dirs) {
            const base = normalize(join(dir, relative));
            if (base !== dir && !base.startsWith(dir + sep)) continue;
            const candidates = relative.endsWith("/") ? [join(base, "index.html")] : [base, `${base}.html`];
            const found = candidates.find((file) => existsSync(file) && statSync(file).isFile());
            if (found) return found;
        }
    }
    return undefined;
}

async function renderTemplate(source: string, mounts: Mount[], req: IncomingMessage, depth = 0): Promise<string> {
    if (depth > 5) throw new TemplateError("include depth exceeded");
    let output = "";
    let cursor = 0;
    const actions = /\{\{(.*?)\}\}/gs;
    for (const match of source.matchAll(actions)) {
        output += source.slice(cursor, match.index);
        cursor = match.index! + match[0].length;
        const action = match[1].trim();

        const include = /^include\s+"([^"]+)"$/.exec(action);
        const header = /^\.Req\.Header\.Get\s+"([^"]+)"$/.exec(action);
        if (include) {
            const file = resolveFile(mounts, include[1]);
            if (!file) throw new TemplateError(`include: file not found ${include[1]}`);
            output += await renderTemplate(await readFile(file, "utf8"), mounts, req, depth + 1);
        } else if (header) {
            const value = req.headers[header[1].toLowerCase()];
            output += Array.isArray(value) ? value[0] : value ?? "";
        } else {
            throw new TemplateError(`unsupported template action: ${match[0]}`);
        }
    }
    return output + source.slice(cursor);
}

export async function startHostServer(mounts: Mount[], port = 0): Promise<HostServer> {
    const server: Server = createServer(async (req, res) => {
        try {
            const urlPath = new URL(req.url ?? "/", "http://host").pathname;
            const file = resolveFile(mounts, urlPath);
            if (!file) {
                res.writeHead(404, {"content-type": "text/plain"}).end("Not found");
                return;
            }
            const type = contentTypes[extname(file)] ?? "application/octet-stream";
            const body = type.startsWith("text/html")
                ? await renderTemplate(await readFile(file, "utf8"), mounts, req)
                : await readFile(file);
            res.writeHead(200, {"content-type": type, "cache-control": "no-store"}).end(body);
        } catch (error) {
            const prefix = error instanceof TemplateError ? "Template error" : "Server error";
            res.writeHead(500, {"content-type": "text/plain"}).end(`${prefix}: ${(error as Error).message}`);
        }
    });

    await new Promise<void>((resolvePromise) => server.listen(port, "127.0.0.1", resolvePromise));
    const address = server.address();
    if (!address || typeof address !== "object") throw new Error("Host server has no address");

    return {
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise<void>((resolvePromise) => {
            server.closeAllConnections();
            server.close(() => resolvePromise());
        }),
    };
}
