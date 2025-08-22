import crypto from "node:crypto";
import path from "path";
import { findClosestLayout } from "../../helpers/layoutDiscovery.js";

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
        configResolved(config: any) {
            // Config resolved
        },
        buildStart() {
            // Build started
        },
        transform(code: string, id: string) {
            // Check if this is a page file
            const isPageFile = Object.values(entries).includes(id);

            if (!isPageFile) {
                return null;
            }

            const componentName = getDefaultExportFunctionName(code);

            if (!componentName) {
                return null;
            }

            // Find the closest layout for this page
            const rootDir = path.resolve(process.cwd(), "src");
            const layoutPath = findClosestLayout(id, rootDir);
            
            if (!layoutPath) {
                console.warn(`No layout found for page ${id}, falling back to default App`);
                return null;
            }

            // Get relative path for layout import
            const layoutRelativePath = path.relative(path.dirname(id), layoutPath).replace(/\\/g, '/');
            const layoutImportPath = layoutRelativePath.startsWith('.') ? layoutRelativePath : `./${layoutRelativePath}`;

            // Component found, generating hydration code
            const importReactDOM = `import ReactDOM from 'react-dom/client';`;

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
    ReactDOM.hydrateRoot(document.getElementById(rootId), React.createElement(${componentName}, {data: initialData}));
  });
}`;
            const transformedCode = importReactDOM + "\n" + code + "\n" + additionalCode;

            return {
                code: transformedCode,
                map: null,
            };
        },
    };
};
