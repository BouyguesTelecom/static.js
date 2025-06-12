import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

const outputDir = path.resolve(process.cwd(), "dist");

export const createPage = ({
  data,
  AppComponent,
  PageComponent,
  initialDatasId,
  rootId,
  pageName,
  JSfileName,
}) => {
  const template = `<link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/@trilogy-ds/styles'/>
<div id=app-{{rootId}}>{{html}}
${data ? `<script id=initial-data-{{initialDatasId}} type="application/json">${JSON.stringify(data)}</script>` : ""}
${JSfileName ? `<script type="module" src="{{scriptPath}}"></script>` : ""}
</div>
`;

  const component = React.createElement(AppComponent, {
    Component: PageComponent,
    props: { data },
  });

  const htmlContent = template
    .replace("{{initialDatasId}}", initialDatasId)
    .replace("{{rootId}}", rootId)
    .replace("{{html}}", ReactDOMServer.renderToString(component))
    .replace("{{scriptPath}}", `${JSfileName}.js`);

  fs.writeFileSync(path.join(outputDir, `${pageName}.html`), htmlContent);
};
