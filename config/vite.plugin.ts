import fs from "fs";
import crypto from "node:crypto";
import path from "path";

const getDefaultExportFunctionName = (code: string) => {
  const defaultExportRegex = /export\s+default\s+function\s+(\w+)/;
  const match = code.match(defaultExportRegex);
  if (match && match[1]) return match[1];
  const defaultVarExportRegex = /export\s+default\s+(\w+)/;
  const varMatch = code.match(defaultVarExportRegex);
  if (varMatch && varMatch[1]) return varMatch[1];
  return null;
};

export const addHydrationCodePlugin = (entries: { [key: string]: string }) => {
  return {
    name: "add-hydration-code",
    transform(code: string, id: string) {
      if (!Object.values(entries).includes(id)) return null;
      const componentName = getDefaultExportFunctionName(code);

      if (!componentName) {
        console.warn(`No default export found in ${id}`);
        return null;
      }

      const importReactDOM = `import ReactDOM from 'react-dom/client';`;
      const importApp = `import { App } from "@/app";`;

      const rootId = crypto
        .createHash("sha256")
        .update(`app-${id}`)
        .digest("hex")
        .slice(0, 10);

      const initialDatasId = crypto
        .createHash("sha256")
        .update(`initial-data-${id}`)
        .digest("hex")
        .slice(0, 10);

      const additionalCode = `
        export const rootId = 'app-${rootId}';
        export const initialDatasId = 'initial-data-${initialDatasId}';

        if (typeof document !== 'undefined') {
          document.addEventListener('DOMContentLoaded', () => {
            const initialDataScript = document.getElementById(initialDatasId);
            const initialData = initialDataScript ? JSON.parse(initialDataScript.textContent || '{}') : {title: ''};
            ReactDOM.hydrateRoot(document.getElementById(rootId), App({Component:${componentName}, props: {data: initialData}}));
          });
        }
      `;

      const transformedCode =
        importReactDOM + "\n" + importApp + "\n" + code + "\n" + additionalCode;

      return {
        code: transformedCode,
        map: null,
      };
    },
  };
};

export const noJsPlugin = (entries: { [key: string]: string }) => {
  return {
    name: "no-js-plugin",
    buildStart() {
      const excludedFiles: string[] = [];

      Object.entries(entries).forEach(([name, path]) => {
        const content = fs.readFileSync(path, "utf8");
        const firstLine = content.split("\n")[0];

        if (firstLine.includes("no scripts")) {
          delete entries[name];
          excludedFiles.push(name);
          console.log(
            `Excluding ${name} from build due to "no scripts" directive.`
          );
        }
      });

      const cacheDir = path.resolve(process.cwd(), "cache");
      const excludedFilePath = path.resolve(cacheDir, "excludedFiles.json");

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      fs.writeFileSync(
        excludedFilePath,
        JSON.stringify(excludedFiles, null, 2),
        "utf8"
      );
    },
  };
};
