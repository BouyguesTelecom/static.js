import fs from "fs/promises";
import crypto from "node:crypto";
import path from "path";
import {createPage} from "../helpers/createPage.js";
import {CONFIG} from "../server/config/index.js";
import {loadCacheEntries} from "../helpers/cachePages";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function loadJson(filePath: string) {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
}

async function main() {
    loadCacheEntries(CONFIG.PROJECT_ROOT);
    const excludedJSFiles = await loadJson(
        path.join(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR, "cache/excludedFiles.json")
    );
    const files = await loadJson(
        path.join(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR, "cache/pagesCache.json")
    );

    const processPage = async (page: { path: string; pageName: string }) => {
        try {
            let data;
            const absolutePath = page.path;
            const pageModule = await import(absolutePath);
            const appModule = await import(`${CONFIG.PROJECT_ROOT}/src/app.tsx`);
            const fileName = path.basename(page.path, path.extname(page.path));

            const AppComponent = appModule.App;
            const PageComponent = pageModule.default;
            const getStaticProps = pageModule?.getStaticProps;
            const getStaticPaths = pageModule?.getStaticPaths;
            const injectJS = !excludedJSFiles.includes(page.pageName);

            const rootId = crypto
                .createHash("sha256")
                .update(`app-${absolutePath}`)
                .digest("hex")
                .slice(0, 10);

            const initialDatasId = crypto
                .createHash("sha256")
                .update(`initial-data-${absolutePath}`)
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
                            const paramKey = fileName.replace(/[\[\]]/g, "");
                            const slug = param.params[paramKey];
                            if (slug) {
                                const {props} = await getStaticProps(param);
                                const pageName = page.pageName.replace(/\[.*?\]/, slug);
                                const JSfileName =
                                    injectJS && fileName.replace(/\[(.*?)\]/g, "_$1_");

                                createPage({
                                    data: props.data,
                                    AppComponent,
                                    PageComponent,
                                    initialDatasId,
                                    rootId,
                                    pageName,
                                    JSfileName: JSfileName,
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
                    JSfileName: injectJS && fileName,
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
