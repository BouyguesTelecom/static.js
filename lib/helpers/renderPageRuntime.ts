import fs from "fs/promises";
import crypto from "node:crypto";
import path from "path";
import React from "react";
import { createPage } from "./createPage.js";
import { readPages } from "./readPages.js";
import { CONFIG } from "../server/config/index.js";
import { findClosestLayout } from "./layoutDiscovery.js";
import { hasStyles } from "./styleDiscovery.js";

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
      
      // Try exact match first
      if (pages[cleanPath]) {
        matchedPage = { path: pages[cleanPath], pageName: cleanPath };
      } else {
        // Try to match with different prefixes (for flexibility)
        const possiblePaths = [
          cleanPath,
          `partials/${cleanPath}`,
          cleanPath.replace(/^partials\//, "")
        ];
        
        for (const testPath of possiblePaths) {
          if (pages[testPath]) {
            matchedPage = { path: pages[testPath], pageName: testPath };
            break;
          }
        }
        
        // If still no match, try dynamic routes
        if (!matchedPage) {
          for (const [pageName, pagePath] of Object.entries(pages)) {
            if (pageName.includes("[") && pageName.includes("]")) {
              // Extract the dynamic parameter name
              const paramMatch = pageName.match(/\[([^\]]+)\]/);
              if (paramMatch) {
                const paramName = paramMatch[1];
                
                // Try matching against multiple possible paths
                for (const testPath of possiblePaths) {
                  // Create a regex pattern from the page name
                  const regexPattern = pageName.replace(/\[([^\]]+)\]/g, '([^/]+)');
                  const regex = new RegExp(`^${regexPattern}$`);
                  
                  const match = testPath.match(regex);
                  if (match) {
                    // Extract the parameter value from the matched groups
                    const paramValue = match[1];
                    if (paramValue) {
                      matchedPage = { path: pagePath, pageName };
                      matchedParams[paramName] = paramValue;
                      break;
                    }
                  }
                }
                
                if (matchedPage) break;
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
    
    // Load page data.json if it exists
    const pageDir = path.dirname(absolutePath);
    const dataJsonPath = path.join(pageDir, 'data.json');
    let pageData = {};
    
    try {
      const dataContent = await fs.readFile(dataJsonPath, 'utf-8');
      pageData = JSON.parse(dataContent);
    } catch (error) {
      // data.json doesn't exist, use empty object
    }
    
    // Discover the closest layout for this page
    const layoutPath = findClosestLayout(absolutePath, rootDir);
    if (!layoutPath) {
      throw new Error(`No layout found for page ${page.pageName}`);
    }
    
    const layoutModule = await import(`${layoutPath}${cacheBuster}`);
    const appModule = await import(`${rootDir}/app.tsx${cacheBuster}`);
    const fileName = path.basename(page.path, path.extname(page.path));

    // Create a dynamic App component that uses the discovered layout
    const LayoutComponent = layoutModule.Layout;
    
    if (!LayoutComponent) {
      throw new Error(`Layout component not found in ${layoutPath}. Make sure it exports 'Layout'.`);
    }
    
    // Create a wrapper App component that uses the actual App component
    const AppComponent = ({ Component, props }: { Component: React.FC; props: any }) => {
      // Create a layout wrapper that accepts pageData
      const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement(LayoutComponent, { pageData, children });
      };
      
      // Use the actual App component and wrap it with our layout
      return React.createElement(LayoutWrapper, {
        children: React.createElement(appModule.App, { Component, props, pageData })
      });
    };

    const PageComponent = pageModule.default;
    const getStaticProps = pageModule?.getStaticProps;
    const getStaticPaths = pageModule?.getStaticPaths;
    const injectJS = !excludedJSFiles.includes(page.pageName);

  // Replace [param] with param name so the hash matches the JS file path
  const hashKey = page.pageName.replace(/\[([^\]]+)\]/g, '$1');
  const rootId = crypto
    .createHash("sha256")
    .update(`app-${hashKey}`)
    .digest("hex")
    .slice(0, 10);

  const initialDatasId = crypto
    .createHash("sha256")
    .update(`initial-data-${hashKey}`)
    .digest("hex")
    .slice(0, 10);

  if (!PageComponent) {
    throw new Error(
      `Failed to import PageComponent from ${page.pageName}.tsx`
    );
  }

  // Handle getStaticProps with or without dynamic params
  const isDynamicRoute = Object.keys(params).length > 0;
  if (getStaticProps) {
    if (isDynamicRoute) {
      // Dynamic route with params
      const { props } = await getStaticProps({ params });
      data = props.data;
    } else {
      // Static route
      const { props } = await getStaticProps();
      data = props.data;
    }
  }

  // Determine JS file path: replace [param] with param name (e.g., guide-pratique/[category] -> guide-pratique/category)
  const jsFilePath = page.pageName.replace(/\[([^\]]+)\]/g, '$1');

  // Check if this page has styles (from page or layouts)
  const pageHasStyles = hasStyles(absolutePath, rootDir);
  const cssFilePath = pageHasStyles
    ? page.pageName.replace(/\[([^\]]+)\]/g, '$1')
    : false;

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
      JSfileName: injectJS && jsFilePath,
      CSSfileName: cssFilePath,
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
      JSfileName: injectJS && jsFilePath,
      CSSfileName: cssFilePath,
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
