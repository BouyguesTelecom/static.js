import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

const outputDir = path.resolve(process.cwd(), "dist");

interface IcreatePage {
  data:any,
  AppComponent: React.FC<{ Component: React.FC; props: {} }>,
  PageComponent: () => React.JSX.Element,
  initialDatasId: string,
  rootId:string,
  pageName:string,
  JSfileName:string | false,
}

export const createPage = ({
  data,
  AppComponent,
  PageComponent,
  initialDatasId,
  rootId,
  pageName,
  JSfileName,
}: IcreatePage) => {
  const template = `
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
