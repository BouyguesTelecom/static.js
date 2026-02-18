import React from "react";
import { collectHeadElement } from "./HeadManager.js";

interface HeadProps {
  children: React.ReactNode;
}

/**
 * Declarative <Head> component for SSR/SSG head customization.
 *
 * Usage:
 * ```tsx
 * import { Head } from '@bouygues-telecom/staticjs/head';
 *
 * export default function MyPage() {
 *   return (
 *     <>
 *       <Head>
 *         <title>My Page</title>
 *         <meta name="description" content="Page description" />
 *       </Head>
 *       <div>Page content</div>
 *     </>
 *   );
 * }
 * ```
 *
 * Elements are merged with the Layout's <head>:
 * - <title> replaces the existing title
 * - <meta name="X"> replaces existing meta with the same name
 * - Everything else is appended
 */
export const Head: React.FC<HeadProps> = ({ children }) => {
  collectHeadElement(children);
  return null;
};
