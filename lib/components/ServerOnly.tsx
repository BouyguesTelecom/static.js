import React, { useState, useId, createContext, useContext, useRef } from 'react';

interface ServerOnlyProps {
  /**
   * Content that may contain Go/Caddy template expressions.
   * This content will be rendered on the server and preserved on the client
   * without React hydration interference.
   */
  children: React.ReactNode;
  /**
   * The HTML tag to wrap the content in. Defaults to 'span'.
   * Use 'div' for block-level content.
   */
  as?: 'span' | 'div';
  /**
   * Optional CSS class name to apply to the wrapper element.
   */
  className?: string;
  /**
   * Optional stable ID for matching. If not provided, context-based or positional matching is used.
   */
  id?: string;
}

/**
 * Check if we're running on the client side
 */
const isClientSide = (): boolean => typeof window !== 'undefined';

/**
 * Global storage for captured server content.
 */
declare global {
  interface Window {
    __serverOnlyById?: Map<string, string>;
    __serverOnlyByOrder?: string[];
    __serverOnlyIndex?: number;
    __serverElementById?: Map<string, { attrs: Record<string, string>; innerHTML: string; orderIndex: number }>;
    __serverElementByOrder?: Array<{ id: string; attrs: Record<string, string>; innerHTML: string }>;
    __serverElementConsumed?: Set<number>;
    __capturedServerData?: boolean;
  }
}

/**
 * Capture all server content from the DOM before React modifies it.
 */
const captureAllServerContent = (): void => {
  if (typeof window === 'undefined') return;
  if (window.__capturedServerData) return;
  window.__capturedServerData = true;

  // Capture ServerOnly elements
  window.__serverOnlyById = new Map();
  window.__serverOnlyByOrder = [];
  const serverOnlyElements = document.querySelectorAll('[data-server-only]');
  serverOnlyElements.forEach((el) => {
    const content = el.innerHTML;
    // Always add to ID map for direct ID lookup
    if (el.id) {
      window.__serverOnlyById!.set(el.id, content);
    }
    // Only add to order array if NOT inside a ServerElement (those use context)
    if (!el.closest('[data-server-element]')) {
      window.__serverOnlyByOrder!.push(content);
    }
  });
  window.__serverOnlyIndex = 0;

  // Capture ServerElement elements
  window.__serverElementById = new Map();
  window.__serverElementByOrder = [];
  window.__serverElementConsumed = new Set();
  const serverElementElements = document.querySelectorAll('[data-server-element]');
  serverElementElements.forEach((el, index) => {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attrs[attr.name] = attr.value;
    }
    const data = { id: el.id, attrs, innerHTML: el.innerHTML };
    window.__serverElementByOrder!.push(data);
    if (el.id) {
      // Store with orderIndex so we can mark it consumed when matched by ID
      window.__serverElementById!.set(el.id, { ...data, orderIndex: index });
    }
  });
};

// Auto-capture on module load (runs before React hydration)
if (isClientSide()) {
  captureAllServerContent();
}

/**
 * Context for passing captured innerHTML from ServerElement to nested ServerOnly children.
 */
interface ServerElementContextValue {
  innerHTML: string;
  serverOnlyContents: string[];
  getNextContent: () => string;
}

const ServerElementContext = createContext<ServerElementContextValue | null>(null);

/**
 * Parse innerHTML to extract ServerOnly contents in order.
 */
const parseServerOnlyContents = (innerHTML: string): string[] => {
  if (!innerHTML) return [];

  const contents: string[] = [];
  // Use a regex to find all data-server-only spans/divs and extract their content
  const regex = /<(?:span|div)[^>]*data-server-only[^>]*>([^<]*(?:<(?!\/(?:span|div))[^<]*)*)<\/(?:span|div)>/gi;
  let match;
  while ((match = regex.exec(innerHTML)) !== null) {
    contents.push(match[1] || '');
  }
  return contents;
};

/**
 * Get server-only content by ID or from context.
 */
const getServerOnlyContent = (id?: string): string => {
  if (typeof window === 'undefined') return '';
  captureAllServerContent();

  // Try by ID first
  if (id && window.__serverOnlyById?.has(id)) {
    return window.__serverOnlyById.get(id) || '';
  }

  // Fall back to positional matching (last resort)
  const index = window.__serverOnlyIndex ?? 0;
  const content = window.__serverOnlyByOrder?.[index] ?? '';
  window.__serverOnlyIndex = index + 1;
  return content;
};

/**
 * Wraps content that should be rendered server-side only and not hydrated by React.
 *
 * Use this component to wrap Go/Caddy template expressions that get processed
 * by a template engine after React SSR but before the HTML reaches the browser.
 *
 * @example
 * ```tsx
 * import { ServerOnly } from '@bouygues-telecom/staticjs/server-only';
 *
 * export default function MyPage() {
 *   return (
 *     <div>
 *       <ServerOnly>
 *         {'{{ $forename := or (.Cookie "p_Forename") "Guest" }}'}
 *       </ServerOnly>
 *       <p>Welcome, <ServerOnly>{'{{ $forename }}'}</ServerOnly>!</p>
 *     </div>
 *   );
 * }
 * ```
 */
export const ServerOnly: React.FC<ServerOnlyProps> = ({ children, as: Tag = 'span', className, id: providedId }) => {
  const reactId = useId();
  const id = providedId || `so${reactId.replace(/:/g, '')}`;

  // Check for parent ServerElement context
  const parentContext = useContext(ServerElementContext);

  // Capture content once during initial render
  const [content] = useState(() => {
    if (!isClientSide()) {
      return typeof children === 'string' ? children : '';
    }

    // 1. Try by provided ID
    if (providedId && window.__serverOnlyById?.has(providedId)) {
      return window.__serverOnlyById.get(providedId) || '';
    }

    // 2. Try from parent ServerElement context
    if (parentContext) {
      return parentContext.getNextContent();
    }

    // 3. Fall back to global positional matching
    return getServerOnlyContent();
  });

  return (
    <Tag
      id={id}
      data-server-only=""
      className={className}
      dangerouslySetInnerHTML={{ __html: content }}
      suppressHydrationWarning
    />
  );
};

ServerOnly.displayName = 'ServerOnly';

/**
 * @deprecated Use ServerOnly directly - no script injection needed with the new approach
 */
export const ServerOnlyScript: React.FC = () => null;

interface ServerElementProps {
  /**
   * The HTML tag or custom component to render.
   * Can be an HTML tag name ('button', 'div') or a React component (Button, Link).
   */
  as: keyof React.JSX.IntrinsicElements | React.ComponentType<any>;
  /**
   * Props that contain Go/Caddy template expressions.
   * These will be read from the DOM on the client to get the Caddy-processed values.
   * Undefined values are filtered out.
   */
  serverProps?: Record<string, string | undefined>;
  /**
   * Regular React children.
   */
  children?: React.ReactNode;
  /**
   * All other props are passed through to the element.
   */
  [key: string]: any;
}

/**
 * Convert camelCase to kebab-case for HTML attribute names.
 */
const toKebabCase = (str: string): string => {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
};

/**
 * Get server-element data by ID or by position.
 */
const getServerElementData = (id?: string): { attrs: Record<string, string>; innerHTML: string } | null => {
  if (typeof window === 'undefined') return null;
  captureAllServerContent();

  // Try by ID first
  if (id && window.__serverElementById?.has(id)) {
    const data = window.__serverElementById.get(id);
    if (data) {
      // Mark this position as consumed so positional matching skips it
      window.__serverElementConsumed?.add(data.orderIndex);
      return { attrs: data.attrs, innerHTML: data.innerHTML };
    }
  }

  // Fall back to positional matching, skipping consumed positions
  const consumed = window.__serverElementConsumed ?? new Set();
  const orderArray = window.__serverElementByOrder ?? [];

  for (let i = 0; i < orderArray.length; i++) {
    if (!consumed.has(i)) {
      consumed.add(i);
      window.__serverElementConsumed = consumed;
      return orderArray[i] ?? null;
    }
  }

  return null;
};

/**
 * Filter out undefined values from serverProps.
 */
const filterDefinedProps = (props: Record<string, string | undefined>): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
};

/**
 * Renders an HTML element with support for Go/Caddy template expressions in attributes.
 *
 * IMPORTANT: When using ServerElement with custom components, you MUST provide a stable `id` prop
 * to ensure proper matching between server and client.
 *
 * @example
 * ```tsx
 * import { ServerElement } from '@bouygues-telecom/staticjs/server-only';
 *
 * export default function MyPage() {
 *   return (
 *     <ServerElement
 *       as="button"
 *       id="my-button"
 *       serverProps={{
 *         'aria-label': '{{ $forename }}',
 *       }}
 *     >
 *       Click me
 *     </ServerElement>
 *   );
 * }
 * ```
 */
export const ServerElement: React.FC<ServerElementProps> = ({
  as,
  serverProps = {},
  children,
  ...restProps
}) => {
  const Tag = as as React.ElementType;
  const reactId = useId();
  const providedId = restProps.id;
  const id = providedId || `se${reactId.replace(/:/g, '')}`;

  // Filter out undefined values from serverProps
  const definedServerProps = filterDefinedProps(serverProps);

  // For context: track which ServerOnly content we've served
  const serverOnlyIndexRef = useRef(0);

  // Capture data once during initial render
  const [capturedData] = useState(() => {
    if (!isClientSide()) {
      return { attrs: definedServerProps, innerHTML: '', serverOnlyContents: [] as string[] };
    }

    const data = getServerElementData(providedId);
    if (!data) {
      return { attrs: definedServerProps, innerHTML: '', serverOnlyContents: [] as string[] };
    }

    // Extract the relevant attributes
    const resolvedAttrs: Record<string, string> = {};
    for (const key of Object.keys(definedServerProps)) {
      let attrName = key;
      if (key === 'className') attrName = 'class';
      else if (key === 'htmlFor') attrName = 'for';
      else attrName = toKebabCase(key);

      if (data.attrs[attrName] !== undefined) {
        resolvedAttrs[key] = data.attrs[attrName];
      }
    }

    // Parse ServerOnly contents from innerHTML for context
    const serverOnlyContents = parseServerOnlyContents(data.innerHTML);

    return { attrs: resolvedAttrs, innerHTML: data.innerHTML, serverOnlyContents };
  });

  // Create context value for ServerOnly children
  const contextValue: ServerElementContextValue = {
    innerHTML: capturedData.innerHTML,
    serverOnlyContents: capturedData.serverOnlyContents,
    getNextContent: () => {
      const index = serverOnlyIndexRef.current;
      serverOnlyIndexRef.current = index + 1;
      return capturedData.serverOnlyContents[index] || '';
    }
  };

  const isNativeElement = typeof as === 'string';

  if (!isClientSide()) {
    // Server: render with template expressions (no context needed)
    return (
      <Tag id={id} {...restProps} {...definedServerProps} data-server-element="">
        {children}
      </Tag>
    );
  }

  // Client: use resolved attributes and provide context for nested ServerOnly
  if (isNativeElement) {
    // For native HTML elements, use dangerouslySetInnerHTML
    return (
      <Tag
        id={id}
        {...restProps}
        {...capturedData.attrs}
        data-server-element=""
        dangerouslySetInnerHTML={{ __html: capturedData.innerHTML }}
        suppressHydrationWarning
      />
    );
  }

  // For custom components, provide context for nested ServerOnly children
  return (
    <ServerElementContext.Provider value={contextValue}>
      <Tag
        id={id}
        {...restProps}
        {...capturedData.attrs}
        data-server-element=""
        suppressHydrationWarning
      >
        {children}
      </Tag>
    </ServerElementContext.Provider>
  );
};

ServerElement.displayName = 'ServerElement';
