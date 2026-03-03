# StaticJS

A modern static site generator for React applications with smart revalidation and hot reloading.

## Features

- ⚡ Fast static site generation with React & TypeScript
- 🔄 WebSocket-based hot reloading during development
- 🎯 Smart page revalidation - rebuild specific pages without full rebuilds
- 🛠️ Simple CLI commands
- 📦 Optimized production builds with Vite

## Prerequisites

- Node.js >= 18.0.0
- npm >= 7.0.0

## Installation

```bash
npm install @bouygues-telecom/staticjs -g
```

## Quick Start

### Create a new project

```bash
create-staticjs-app
cd your-project
npm install
```

### Development

```bash
npm run dev
```

Your site will be available at `http://localhost:3000`

### Production

```bash
npm run build
npm run start
```

Production server runs at `http://localhost:3456`

## CLI Commands

- `static dev` - Start development server with hot reload
- `static build` - Build static site for production
- `static start` - Serve built files in production mode

See [CLI_USAGE.md](CLI_USAGE.md) for detailed command documentation.

## Project Structure

```
your-project/
├── src/
│   ├── pages/          # Your pages
│   ├── components/     # Reusable components
│   ├── styles/         # Style files
│   └── revalidate.ts   # Custom revalidation handler (optional)
├── _build/             # Generated static files
└── static.config.ts    # Configuration
```

## Configuration

StaticJS is configured via a `static.config.ts` (or `.js` / `.mjs`) file at the root of your project.

```typescript
// static.config.ts
export default {
    PORT: 5678,
    CORS_ORIGINS: ["https://example.com"],
    CSP_DIRECTIVES: {
        scriptSrc: ["https://cdn.example.com"],
    },
};
```

### Available options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `PORT` | `number` | `3456` | Server port |
| `NODE_ENV` | `string` | `"development"` | Environment (`development`, `production`, `test`) |
| `PROJECT_ROOT` | `string` | `process.cwd()` | Project root directory |
| `BUILD_DIR` | `string` | `"_build"` | Output directory name |
| `REQUEST_TIMEOUT` | `number` | `30000` | Request timeout in ms |
| `BODY_SIZE_LIMIT` | `string` | `"10mb"` | Max request body size |
| `RATE_LIMIT_WINDOW` | `number` | `900000` | Rate limit window in ms (15 min) |
| `RATE_LIMIT_MAX` | `number` | `100` | Max requests per window |
| `REVALIDATE_RATE_LIMIT_MAX` | `number` | `10` | Max revalidation requests per window |
| `REVALIDATE_API_KEY` | `string` | `""` | API key for the revalidate endpoint (required in production) |
| `REVALIDATE_REQUEST_TIMEOUT` | `number` | `120000` | Revalidation request timeout in ms (2 min) |
| `CORS_ORIGINS` | `string[]` | `[]` | Allowed CORS origins |
| `TRUST_PROXY` | `number \| string \| string[]` | `1` | Trusted proxy hops / IPs for client-IP detection (see below) |
| `CACHE_MAX_AGE` | `number` | `86400` (prod) / `0` (dev) | Cache max-age in seconds |
| `HOT_RELOAD_ENABLED` | `boolean` | `true` (dev) | Enable hot reload |
| `WEBSOCKET_ENABLED` | `boolean` | `true` (dev) | Enable WebSocket server |
| `FILE_WATCHING_ENABLED` | `boolean` | `true` (dev) | Enable file watcher |
| `WEBSOCKET_PATH` | `string` | `"/ws"` | WebSocket endpoint path |
| `FILE_WATCH_DEBOUNCE` | `number` | `300` | File watch debounce in ms |
| `SUPPRESS_MODULE_DIRECTIVE_WARNINGS` | `boolean` | `false` | Suppress Vite `MODULE_LEVEL_DIRECTIVE` warnings |
| `CSP_DIRECTIVES` | `Record<string, string[]>` | `{}` | Additional Content Security Policy sources (see below) |
| `DECODE_TEMPLATE_EXPRESSIONS` | `boolean` | `false` | Decode HTML entities within `{{ }}` template expressions (see below) |

### Content Security Policy (CSP)

StaticJS sets the following CSP defaults via [Helmet](https://helmetjs.github.io/):

| Directive | Default sources |
|-----------|----------------|
| `defaultSrc` | `'self'` |
| `scriptSrc` | `'self'` |
| `styleSrc` | `'self'`, `'unsafe-inline'`, `https://assets.bouyguestelecom.fr` |
| `imgSrc` | `'self'`, `data:`, `https:` |

Use `CSP_DIRECTIVES` to add extra trusted sources. Values are **merged** with the defaults (`'self'` is always included):

```typescript
// static.config.ts
export default {
    CSP_DIRECTIVES: {
        scriptSrc: ["https://assets.bouyguestelecom.fr", "https://cdn.example.com"],
        fontSrc: ["https://fonts.gstatic.com"],
        connectSrc: ["https://api.example.com"],
    },
};
```

This would produce the following CSP headers:

```
script-src 'self' https://assets.bouyguestelecom.fr https://cdn.example.com;
font-src https://fonts.gstatic.com;
connect-src https://api.example.com;
```

Any valid [CSP directive name](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy#directives) can be used (camelCase): `defaultSrc`, `scriptSrc`, `styleSrc`, `imgSrc`, `connectSrc`, `fontSrc`, `frameSrc`, `mediaSrc`, `workerSrc`, etc.

### Trusted Proxy (`TRUST_PROXY`)

StaticJS sits behind a reverse proxy (Caddy, nginx, AWS ALB, etc.) in most deployments. The `TRUST_PROXY` setting tells Express how many proxy hops to trust when reading the client IP from the `X-Forwarded-For` header. This is used by rate limiting and other IP-based logic.

| Value type | Example | Meaning |
|------------|---------|---------|
| `number` | `1` | Trust the first *n* proxy hops (default) |
| `string` | `"loopback"` | Trust a named range or subnet (e.g. `"loopback"`, `"10.0.0.0/8"`) |
| `string[]` | `["10.0.0.1", "10.0.0.2"]` | Trust only the listed addresses |

```typescript
// static.config.ts — behind two reverse proxies
export default {
    TRUST_PROXY: 2,
};
```

```typescript
// static.config.ts — trust a specific subnet
export default {
    TRUST_PROXY: "10.0.0.0/8",
};
```

> **Note:** Setting `trust proxy` to `true` (boolean) is intentionally rejected because it allows trivial bypass of IP-based rate limiting. Use a specific hop count or address instead.

### Template Expression Decoding (`DECODE_TEMPLATE_EXPRESSIONS`)

When serving HTML through a template engine like Caddy's Go templates, you may embed expressions like `{{ .SomeVar }}` or `{{ include "/path/file" }}` in your React components. However, React's SSR HTML-encodes text nodes, turning `"` into `&quot;`, which breaks these template engines.

Enable `DECODE_TEMPLATE_EXPRESSIONS` to automatically decode HTML entities **only within `{{ }}`** blocks:

```typescript
// static.config.ts
export default {
    DECODE_TEMPLATE_EXPRESSIONS: true,
};
```

This decodes the following entities inside template expressions:
- `&quot;` → `"`
- `&amp;` → `&`
- `&lt;` → `<`
- `&gt;` → `>`
- `&#39;` / `&#x27;` → `'`

HTML attributes outside of `{{ }}` remain properly encoded.

### `<ServerOnly>` Component

When using Go/Caddy templates within React components, you may encounter hydration mismatches. The server renders `{{ $forename }}`, Caddy processes it to "Jean", but the client-side React still expects the literal `{{ $forename }}` string and "corrects" the DOM.

The `<ServerOnly>` component prevents React from hydrating its children, preserving the server-rendered (Caddy-processed) content:

```tsx
import { ServerOnly } from '@bouygues-telecom/staticjs/server-only';

export default function MyPage() {
  return (
    <div>
      <ServerOnly>
        {'{{ $forename := or (.Cookie "p_Forename") "Guest" }}'}
      </ServerOnly>
      <p>Welcome, <ServerOnly>{'{{ $forename }}'}</ServerOnly>!</p>
    </div>
  );
}
```

Props:
- `children`: Content containing Go template expressions
- `as`: Wrapper element tag (`'span'` or `'div'`, defaults to `'span'`)
- `className`: Optional CSS class name for the wrapper element

**How it works:**
1. Server renders: `<span id="X">{{ $forename }}</span>`
2. Caddy processes: `<span id="X">Jean</span>`
3. Client initial render: Reads "Jean" from DOM before React can modify it
4. Client renders with `dangerouslySetInnerHTML={{ __html: "Jean" }}`
5. React hydrates: DOM already matches, no mismatch!

**Note:** Content inside `<ServerOnly>` will not have React event handlers or state. Use it only for static template expressions.

### `<ServerElement>` Component

When you have Go template expressions in **element attributes** (not just text content), use `<ServerElement>`:

```tsx
import { ServerElement } from '@bouygues-telecom/staticjs/server-only';

export default function MyPage() {
  return (
    <ServerElement
      as="button"
      serverProps={{
        'aria-label': '{{ $forename }}',
        'data-user': '{{ .User.ID }}',
      }}
      className="button"
      type="button"
    >
      <ServerOnly>{'{{ $forename }}'}</ServerOnly>
    </ServerElement>
  );
}
```

Props:
- `as`: The HTML tag or custom component to render (e.g., `'button'`, `'div'`, `Button`, `Link`)
- `serverProps`: Object containing attributes with Go template expressions (values can be `undefined`)
- `children`: Element content (wrap template expressions in `<ServerOnly>`)
- All other props are passed through to the element

**With custom components:**

```tsx
import { Button } from '@trilogy-ds/react';

<ServerElement
  as={Button}
  serverProps={{ 'aria-label': a11y?.ariaLabel }}
  variant="primary"
>
  <ServerOnly>{'{{ $forename }}'}</ServerOnly>
</ServerElement>
```

**How it works:**
1. Server renders attributes with template expressions
2. Caddy processes them (e.g., `aria-label="Jean"`)
3. Client reads the processed attribute values from the DOM
4. React renders with the correct values - no mismatch!

## Revalidation API

Rebuild specific pages without a full rebuild:

```bash
curl -X POST http://localhost:3000/revalidate \
  -H "Content-Type: application/json" \
  -d '{ "paths": ["home", "about"] }'
```

### Custom revalidation handler

For full control over which pages get rebuilt, create a `src/revalidate.ts` (or `.js` / `.mjs`) file in your project. It must export a default async function that receives the Express request and returns a `string[]` of page paths:

```typescript
// src/revalidate.ts
import { Request } from "express";

// Called before rebuild — return the paths to rebuild (empty = all pages)
export async function beforeRevalidate(req: Request): Promise<string[]> {
    const res = await fetch("https://my-cms.com/updated-pages");
    const pages = await res.json();
    return pages.map((p: any) => p.slug);
}

// Called after rebuild — purge CDN, notify a webhook, etc. (optional)
export async function afterRevalidate(req: Request, paths: string[]): Promise<void> {
    console.log("Rebuilt:", paths);
}
```

If the file does not exist, StaticJS falls back to `req.body.paths`. Both exports are optional.

## Development Setup (Monorepo)

For contributors working on the StaticJS library itself:

```bash
npm install
node setup-dev.js
```

This sets up the development environment with local package linking.

## License

MIT

---

**Built with ❤️ by Bouygues Telecom**
