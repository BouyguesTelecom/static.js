import { Request } from "express";

/**
 * Called before pages are rebuilt.
 *
 * Use it to determine which pages should be rebuilt — fetch from a CMS,
 * read the request body, call an external API, or apply any custom logic.
 * process.env is available (including vars from .env files).
 *
 * Return a string[] of page paths (e.g. ["home", "partials/page1"]).
 * Return an empty array to rebuild all pages.
 *
 * If this file does not exist, StaticJS falls back to req.body.paths.
 */
export async function beforeRevalidate(req: Request): Promise<string[]> {
    const paths = req.body?.paths;

    if (!Array.isArray(paths)) {
        return [];
    }

    return paths;
}

/**
 * Called after pages have been rebuilt.
 * Use it to purge a CDN cache, notify a webhook, log metrics, etc.
 * process.env is available (including vars from .env files).
 *
 * @param req - The original Express request
 * @param paths - The paths that were rebuilt (empty = all pages)
 */
export async function afterRevalidate(req: Request, paths: string[]): Promise<void> {
    console.log(`[afterRevalidate] Rebuilt: ${paths.length > 0 ? paths.join(", ") : "all pages"}`);
}
