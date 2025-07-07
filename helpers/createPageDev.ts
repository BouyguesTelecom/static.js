import fs from "fs";
import path from "path";
import React from "react";
import ReactDOMServer from "react-dom/server";

const outputDir = path.resolve(process.cwd(), "dist");

interface IcreatePageDev {
  data: any,
  AppComponent: React.FC<{ Component: React.FC; props: {} }>,
  PageComponent: () => React.JSX.Element,
  initialDatasId: string,
  rootId: string,
  pageName: string,
  JSfileName: string | false,
  isDev?: boolean,
}

export const createPageDev = ({
  data,
  AppComponent,
  PageComponent,
  initialDatasId,
  rootId,
  pageName,
  JSfileName,
  isDev = false,
}: IcreatePageDev) => {
  // Script de hot reload pour le développement
  const hotReloadScript = isDev ? `
<script type="module">
  // Hot reload client pour StaticJS
  const ws = new WebSocket('ws://localhost:3300');
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'full-reload') {
      console.log('[staticjs] 🔄 Hot reloading...');
      window.location.reload();
    }
  };
  
  ws.onopen = () => {
    console.log('[staticjs] 🔥 Hot reload connected');
  };
  
  ws.onclose = () => {
    console.log('[staticjs] ❌ Hot reload disconnected');
    // Tentative de reconnexion après 1 seconde
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };
  
  ws.onerror = (error) => {
    console.log('[staticjs] ⚠️ Hot reload error:', error);
  };
</script>` : '';

  const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StaticJS App</title>
</head>
<body>
<div id="app-{{rootId}}">{{html}}</div>
${data ? `<script id="initial-data-{{initialDatasId}}" type="application/json">${JSON.stringify(data)}</script>` : ""}
${JSfileName ? `<script type="module" src="{{scriptPath}}"></script>` : ""}
${hotReloadScript}
</body>
</html>`;

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