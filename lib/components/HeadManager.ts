import React from "react";
import ReactDOMServer from "react-dom/server";

const GLOBAL_KEY = "__staticjs_head_elements__";

// Use globalThis to ensure a single shared state across module instances
// (symlinked packages can cause Node.js to load the same file as separate modules)
function getHeadElements(): React.ReactNode[] {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    (globalThis as any)[GLOBAL_KEY] = [];
  }
  return (globalThis as any)[GLOBAL_KEY];
}

/**
 * Clear collected head elements. Call before each renderToString().
 */
export function resetHeadElements(): void {
  (globalThis as any)[GLOBAL_KEY] = [];
}

/**
 * Register head children during SSR render. Called by the <Head> component.
 */
export function collectHeadElement(children: React.ReactNode): void {
  getHeadElements().push(children);
}

/**
 * After renderToString(), merge collected <Head> elements into the HTML string.
 *
 * Merge rules:
 * - <title>: replaces existing <title> in the HTML
 * - <meta name="X">: replaces existing <meta name="X"> in the HTML
 * - Everything else: appended before </head>
 */
export function injectHeadIntoHtml(html: string): string {
  const headElements = getHeadElements();
  if (headElements.length === 0) {
    return html;
  }

  // Render each collected element to HTML fragments
  const titles: string[] = [];
  const metaReplacements: { name: string; html: string }[] = [];
  const appendElements: string[] = [];

  for (const children of headElements) {
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;

      const rendered = ReactDOMServer.renderToStaticMarkup(child);

      if (child.type === "title") {
        titles.push(rendered);
      } else if (
        child.type === "meta" &&
        (child.props as Record<string, unknown>).name
      ) {
        metaReplacements.push({
          name: (child.props as Record<string, unknown>).name as string,
          html: rendered,
        });
      } else {
        appendElements.push(rendered);
      }
    });
  }

  let result = html;

  // Replace <title> — last one wins
  if (titles.length > 0) {
    const newTitle = titles[titles.length - 1];
    result = result.replace(/<title>[\s\S]*?<\/title>/, newTitle);
  }

  // Replace <meta name="X"> tags
  for (const { name, html: metaHtml } of metaReplacements) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const metaRegex = new RegExp(
      `<meta\\s+name="${escapedName}"[^>]*\\/?>`,
      "i"
    );
    if (metaRegex.test(result)) {
      result = result.replace(metaRegex, metaHtml);
    } else {
      // No existing meta with this name — append it
      appendElements.push(metaHtml);
    }
  }

  // Append remaining elements before </head>
  if (appendElements.length > 0) {
    result = result.replace("</head>", appendElements.join("") + "</head>");
  }

  return result;
}
