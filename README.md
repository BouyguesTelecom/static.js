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
│   └── app.tsx         # App entry point
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
| `CORS_ORIGINS` | `string[]` | `[]` | Allowed CORS origins |
| `CACHE_MAX_AGE` | `number` | `86400` (prod) / `0` (dev) | Cache max-age in seconds |
| `HOT_RELOAD_ENABLED` | `boolean` | `true` (dev) | Enable hot reload |
| `WEBSOCKET_ENABLED` | `boolean` | `true` (dev) | Enable WebSocket server |
| `FILE_WATCHING_ENABLED` | `boolean` | `true` (dev) | Enable file watcher |
| `WEBSOCKET_PATH` | `string` | `"/ws"` | WebSocket endpoint path |
| `FILE_WATCH_DEBOUNCE` | `number` | `300` | File watch debounce in ms |
| `SUPPRESS_MODULE_DIRECTIVE_WARNINGS` | `boolean` | `false` | Suppress Vite `MODULE_LEVEL_DIRECTIVE` warnings |
| `CSP_DIRECTIVES` | `Record<string, string[]>` | `{}` | Additional Content Security Policy sources (see below) |

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

## Revalidation API

Rebuild specific pages without a full rebuild:

```bash
curl -X POST http://localhost:3000/revalidate \
  -H "Content-Type: application/json" \
  -d '{ "paths": ["home.tsx", "about.tsx"] }'
```

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
