import { Request } from "express";

/**
 * Custom revalidation handler.
 *
 * This function is called automatically when POST /revalidate is triggered.
 * Use it to determine which pages should be rebuilt — fetch from a CMS,
 * read the request body, call an external API, or apply any custom logic.
 *
 * Return a string[] of page paths (e.g. ["home", "partials/page1"]).
 * Return an empty array to skip the rebuild.
 *
 * If this file does not exist, StaticJS falls back to req.body.paths.
 */
export default async function revalidate(req: Request): Promise<string[]> {
    const paths = req.body?.paths;

    if (!Array.isArray(paths)) {
        return [];
    }

    return paths;
}
