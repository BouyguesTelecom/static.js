import fs from "fs/promises";
import crypto from "node:crypto";
import path from "path";
import React from "react";
import {createPage} from "../helpers/createPage.js";
import {CONFIG} from "../server/config/index.js";
import {loadCacheEntries, loadStylesCache} from "../helpers/cachePages.js";
import {findClosestLayout} from "../helpers/layoutDiscovery.js";

async function loadJson(filePath: string, fallback: any = null) {
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    } catch {
        return fallback;
    }
}

async function main() {
    const files = loadCacheEntries(CONFIG.PROJECT_ROOT, true);
    const excludedJSFiles: string[] = await loadJson(
        path.join(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR, "cache/excludedFiles.json"),
        []
    );
    const stylesCache = loadStylesCache(CONFIG.PROJECT_ROOT);

    const processPage = async (page: { path: string; pageName: string }) => {
        try {
            let data;
            const absolutePath = page.path;
            const pageModule = await import(absolutePath);
            const appModule = await import(`${CONFIG.PROJECT_ROOT}/src/pages/app.tsx`);
            const fileName = path.basename(page.path, path.extname(page.path));

            // Load page data.json if it exists
            const pageDir = path.dirname(absolutePath);
            const dataJsonPath = path.join(pageDir, 'data.json');
            let pageData = {};
            
            try {
                const dataContent = await fs.readFile(dataJsonPath, 'utf-8');
                pageData = JSON.parse(dataContent);
            } catch (error) {
                // data.json doesn't exist, use empty object
            }

            // Discover the closest layout for this page (optional)
            const rootDir = path.resolve(CONFIG.PROJECT_ROOT, "./src");
            const layoutPath = findClosestLayout(absolutePath, rootDir);

            let AppComponent: React.FC<{ Component: React.FC; props: any; pageData?: any }>;

            if (layoutPath) {
                const layoutModule = await import(layoutPath);
                const LayoutComponent = layoutModule.Layout;

                if (!LayoutComponent) {
                    throw new Error(`Layout component not found in ${layoutPath}. Make sure it exports 'Layout'.`);
                }

                AppComponent = ({ Component, props }: { Component: React.FC; props: any; pageData?: any }) => {
                    const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
                        return React.createElement(LayoutComponent, { pageData, children });
                    };
                    return React.createElement(LayoutWrapper, {
                        children: React.createElement(appModule.App, { Component, props, pageData })
                    });
                };
            } else {
                // No layout: render with App component only
                AppComponent = ({ Component, props }: { Component: React.FC; props: any; pageData?: any }) => {
                    return React.createElement(appModule.App, { Component, props, pageData });
                };
            }

            const PageComponent = pageModule.default;
            const getStaticProps = pageModule?.getStaticProps;
            const getStaticPaths = pageModule?.getStaticPaths;
            const injectJS = !excludedJSFiles.includes(page.pageName);
            const hasStyles = stylesCache[page.pageName] && stylesCache[page.pageName].length > 0;

            // Replace [param] with param name so the hash matches between JS and HTML
            const hashKey = page.pageName.replace(/\[([^\]]+)\]/g, '$1');
            const rootId = crypto
                .createHash("sha256")
                .update(`app-${hashKey}`)
                .digest("hex")
                .slice(0, 10);

            const initialDatasId = crypto
                .createHash("sha256")
                .update(`initial-data-${hashKey}`)
                .digest("hex")
                .slice(0, 10);

            if (!PageComponent) {
                throw new Error(`Failed to import PageComponent from ${page.pageName}.tsx`);
            }

            // Handle dynamic routes (pages with both getStaticProps and getStaticPaths)
            if (getStaticPaths) {
                const {paths} = await getStaticPaths();
                if (paths && Array.isArray(paths)) {
                    for (const param of paths) {
                        if (param && param.params) {
                            // Extract ALL parameter names from page name (e.g., "guide-pratique/[category]/[article]" -> ["category", "article"])
                            const paramMatches = [...page.pageName.matchAll(/\[([^\]]+)\]/g)];
                            const paramKeys = paramMatches.map(m => m[1]);

                            // Check that all param values exist
                            const allParamsPresent = paramKeys.length > 0 && paramKeys.every(key => param.params[key]);
                            if (allParamsPresent) {
                                const {props} = await getStaticProps(param);
                                // Replace each [param] with its actual value
                                let pageName = page.pageName;
                                for (const key of paramKeys) {
                                    pageName = pageName.replace(`[${key}]`, param.params[key]);
                                }
                                // For dynamic routes, replace [param] with param name (e.g., guide-pratique/[category] -> guide-pratique/category)
                                const JSfileName =
                                    injectJS && page.pageName.replace(/\[([^\]]+)\]/g, '$1');

                                // For dynamic routes, CSS follows same pattern as JS
                                const CSSfileName = hasStyles && page.pageName.replace(/\[([^\]]+)\]/g, '$1');

                                createPage({
                                    data: props.data,
                                    AppComponent,
                                    PageComponent,
                                    initialDatasId,
                                    rootId,
                                    pageName,
                                    JSfileName: JSfileName,
                                    CSSfileName: CSSfileName,
                                    pageData,
                                });

                                console.log(`✓ ${pageName}.html`);
                            }
                        } else {
                            console.warn(`Skipping invalid path parameter for ${page.pageName}:`, param);
                        }
                    }
                } else {
                    console.warn(`No valid paths returned from getStaticPaths for ${page.pageName}`);
                }
            } else {
                // Handle static routes (pages without getStaticPaths)
                if (getStaticProps) {
                    const {props} = await getStaticProps();
                    data = props.data;
                }

                createPage({
                    data,
                    AppComponent,
                    PageComponent,
                    initialDatasId,
                    rootId,
                    pageName: page.pageName,
                    JSfileName: injectJS && page.pageName,
                    CSSfileName: hasStyles && page.pageName,
                    pageData,
                });

                console.log(`✓ ${page.pageName}.html`);
            }
        } catch (error) {
            console.error(`Error processing ${page.pageName}:`, error);
        }
    };

    const pages = Object.entries(files).map(([pageName, path]) => ({
        pageName: pageName as string,
        path: path as string,
    }));

    pages.forEach(processPage);
}

main();
