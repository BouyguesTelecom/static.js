import fs from "fs";
import path from "path";
import { Writable } from "stream";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import {CONFIG} from "../server/config/index.js";
import {resetHeadElements, injectHeadIntoHtml} from "../components/HeadManager.js";

/**
 * Render a React element to an HTML string, with Suspense support.
 * Uses renderToPipeableStream with onAllReady so that all lazy/suspended
 * components are resolved before the HTML is returned.
 */
function renderToStringAsync(element: React.ReactElement): Promise<string> {
    return new Promise((resolve, reject) => {
        let html = '';
        const writable = new Writable({
            write(chunk, _encoding, callback) {
                html += chunk.toString();
                callback();
            },
        });

        const { pipe } = renderToPipeableStream(element, {
            onAllReady() {
                pipe(writable);
                writable.on('finish', () => resolve(html));
            },
            onError(error) {
                reject(error);
            },
        });
    });
}

interface IcreatePage {
    data: any,
    AppComponent: React.FC<{ Component: React.FC; props: {}; pageData?: any }>,
    PageComponent: () => React.JSX.Element,
    initialDatasId: string,
    rootId: string,
    pageName: string,
    JSfileName: string | false,
    CSSfileName?: string | false, // Optional CSS file name for style injection
    returnHtml?: boolean, // New optional parameter for runtime rendering
    pageData?: any, // New optional parameter for page data
}

export const createPage = async ({
                                     data,
                                     AppComponent,
                                     PageComponent,
                                     initialDatasId,
                                     rootId,
                                     pageName,
                                     JSfileName,
                                     CSSfileName = false, // Default to false for backward compatibility
                                     returnHtml = false, // Default to false for backward compatibility
                                     pageData = {}, // Default to empty object
                                 }: IcreatePage): Promise<string | void> => {
    const template = `{{html}}
${data ? `<script id=initial-data-{{initialDatasId}} type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>` : ""}
${JSfileName ? `<script type="module" src="{{scriptPath}}"></script>` : ""}
`;

    // Create a wrapper component that adds the app div around the page component
    const PageWithAppDiv = (props: any) => {
        return React.createElement('div',
            { id: `app-${rootId}` },
            React.createElement(PageComponent, props)
        );
    };

    const component = React.createElement(AppComponent, {
        Component: PageWithAppDiv,
        props: {data},
        pageData, // Pass pageData to AppComponent
    });

    // Use JSfileName for script path if it's a string (for dynamic routes), otherwise use pageName
    const basePath = CONFIG.BASE_PATH;
    const scriptPath = `${basePath}/${JSfileName || pageName}.js`;
    // Use CSSfileName for style path if it's a string, otherwise use pageName
    const stylePath = `${basePath}/${CSSfileName || pageName}.css`;

    // Reset head collector before rendering, then inject collected elements after
    resetHeadElements();

    const renderedHtml = await renderToStringAsync(component);

    let htmlContent = injectHeadIntoHtml(
        template
            .replace("{{initialDatasId}}", initialDatasId)
            .replace("{{html}}", renderedHtml)
            .replace("{{scriptPath}}", scriptPath)
    );

    // Inject CSS link so the browser loads styles before rendering the body
    if (CSSfileName) {
        const cssLink = `<link rel="stylesheet" href="${stylePath}">`;
        if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace("</head>", `${cssLink}</head>`);
        } else if (htmlContent.includes('<body')) {
            htmlContent = htmlContent.replace(/<body([^>]*)>/, `<body$1>${cssLink}`);
        } else {
            // Layout without <head>/<body> (e.g. partial layouts): prepend the link
            htmlContent = cssLink + htmlContent;
        }
    }

    // Return HTML string for runtime rendering or write to file for build time
    if (returnHtml) {
        return htmlContent;
    } else {
        // If page name contains a slash, create directories
        const pageNameParts = pageName.split("/");
        if (pageNameParts.length > 1) {
            const dirPath = path.join(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR, ...pageNameParts.slice(0, -1));
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, {recursive: true});
            }
        }
        fs.writeFileSync(path.join(CONFIG.PROJECT_ROOT, CONFIG.BUILD_DIR, `${pageName}.html`), htmlContent);
    }
};
