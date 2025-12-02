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
