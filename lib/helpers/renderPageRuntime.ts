process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "fs/promises";
import crypto from "node:crypto";
import path from "path";
import React from "react";
import { createPage } from "./createPage.js";
import { readPages } from "./readPages.js";
import { CONFIG } from "../server/config/index.js";

const rootDir = path.resolve(process.cwd(), "./src");

async function loadJson(filePath: string) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // Return empty object if file doesn't exist (for development mode)
    return {};
  }
}

/**
 * Runtime page rendering function that uses the same logic as build-html.ts
 * but returns HTML string instead of writing to file
 */
export async function renderPageRuntime(requestPath: string, params?: { [key: string]: string }): Promise<string | null> {
  try {
    // Load excluded files for "no scripts" functionality
    const excludedJSFiles = await loadJson(
      path.join(process.cwd(), `./${CONFIG.BUILD_DIR}/cache/excludedFiles.json`)
    );

    // Get available pages using readPages helper
    const pagesDir = path.resolve(process.cwd(), "src/pages");
    const pages = readPages(pagesDir);

    // Find the matching page
    let matchedPage: { path: string; pageName: string } | null = null;
    let matchedParams: { [key: string]: string } = {};

    // Handle root path
    if (requestPath === "/" || requestPath === "") {
      if (pages["index"]) {
        matchedPage = { path: pages["index"], pageName: "index" };
      }
    } else {
      // Remove leading slash and try exact match first
      const cleanPath = requestPath.replace(/^\//, "");
      
      if (pages[cleanPath]) {
        matchedPage = { path: pages[cleanPath], pageName: cleanPath };
      } else {
        // Try to match dynamic routes
        for (const [pageName, pagePath] of Object.entries(pages)) {
          if (pageName.includes("[") && pageName.includes("]")) {
            // Extract the dynamic parameter name
            const paramMatch = pageName.match(/\[([^\]]+)\]/);
            if (paramMatch) {
              const paramName = paramMatch[1];
              const staticPart = pageName.replace(/\[.*?\]/, "");
              
              if (cleanPath.startsWith(staticPart)) {
                const paramValue = cleanPath.replace(staticPart, "").replace(/^\//, "");
                if (paramValue) {
                  matchedPage = { path: pagePath, pageName: cleanPath };
                  matchedParams[paramName] = paramValue;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (!matchedPage) {
      return null; // Page not found
    }

    return await processPageRuntime(matchedPage, excludedJSFiles, matchedParams);
  } catch (error) {
    console.error("Error in renderPageRuntime:", error);
    return null;
  }
}

/**
 * Process a single page for runtime rendering (adapted from build-html.ts processPage)
 */
async function processPageRuntime(
  page: { path: string; pageName: string },
  excludedJSFiles: string[],
  params: { [key: string]: string } = {}
): Promise<string> {
  let data;
  const absolutePath = page.path;
  
  // Add cache busting to avoid module caching issues in development
  const cacheBuster = `?t=${Date.now()}`;
  
  try {
    const pageModule = await import(`${absolutePath}${cacheBuster}`);
    const layoutModule = await import(`${rootDir}/layout.tsx${cacheBuster}`);
    const appModule = await import(`${rootDir}/app.tsx${cacheBuster}`);
    const fileName = path.basename(page.path, path.extname(page.path));

    // Create a dynamic App component that uses the fresh layout
    const LayoutComponent = layoutModule.Layout;
    const OriginalAppComponent = appModule.App;
    
    // Create a wrapper App component that uses the fresh layout
    const AppComponent = ({ Component, props }: { Component: React.FC; props: any }) => {
      return React.createElement(LayoutComponent, { children: React.createElement(Component, props) });
    };
    
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
    throw new Error(
      `Failed to import PageComponent from ${page.pageName}.tsx`
    );
  }

  // Handle getStaticProps with or without dynamic params
  if (getStaticProps) {
    if (Object.keys(params).length > 0) {
      // Dynamic route with params
      const { props } = await getStaticProps({ params });
      data = props.data;
    } else {
      // Static route
      const { props } = await getStaticProps();
      data = props.data;
    }
  }

  // Generate HTML using createPage helper with returnHtml flag
  // Use dynamic import to load createPage from the template directory
  let htmlContent: string;
  try {
    // Try to import createPage from the template's helpers directory
    const templateCreatePagePath = path.resolve(process.cwd(), "../../helpers/createPage.js");
    const { createPage: templateCreatePage } = await import(templateCreatePagePath);
    
    htmlContent = templateCreatePage({
      data,
      AppComponent,
      PageComponent,
      initialDatasId,
      rootId,
      pageName: page.pageName,
      JSfileName: injectJS && fileName,
      returnHtml: true,
    }) as string;
  } catch (error) {
    // Fallback to server's createPage
    htmlContent = await createPage({
      data,
      AppComponent,
      PageComponent,
      initialDatasId,
      rootId,
      pageName: page.pageName,
      JSfileName: injectJS && fileName,
      returnHtml: true,
    }) as string;
  }

  return htmlContent;
  } catch (error) {
    console.error(`[DEBUG] Error in processPageRuntime:`, error);
    throw error;
  }
}

/**
 * Get all available pages for development mode
 */
export function getAvailablePagesRuntime(): { [key: string]: string } {
  const pagesDir = path.resolve(process.cwd(), "src/pages");
  return readPages(pagesDir);
}
