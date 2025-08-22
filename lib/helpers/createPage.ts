import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {CONFIG} from "../server/config/index.js";

interface IcreatePage {
    data: any,
    AppComponent: React.FC<{ Component: React.FC; props: {} }>,
    PageComponent: () => React.JSX.Element,
    initialDatasId: string,
    rootId: string,
    pageName: string,
    JSfileName: string | false,
    returnHtml?: boolean, // New optional parameter for runtime rendering
}

export const createPage = async ({
                                     data,
                                     AppComponent,
                                     PageComponent,
                                     initialDatasId,
                                     rootId,
                                     pageName,
                                     JSfileName,
                                     returnHtml = false, // Default to false for backward compatibility
                                 }: IcreatePage): Promise<string | void> => {
    const template = `
{{html}}
${data ? `<script id=initial-data-{{initialDatasId}} type="application/json">${JSON.stringify(data)}</script>` : ""}
${JSfileName ? `<script type="module" src="{{scriptPath}}"></script>` : ""}
`;

    const component = React.createElement(AppComponent, {
        Component: () => React.createElement('div', {
            id: `app-${rootId}`
        }, React.createElement(PageComponent)),
        props: {data},
    });

    const htmlContent = template
        .replace("{{initialDatasId}}", initialDatasId)
        .replace("{{html}}", ReactDOMServer.renderToString(component))
        .replace("{{scriptPath}}", `${JSfileName}.js`);

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
