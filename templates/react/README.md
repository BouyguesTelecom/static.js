<div align="center">

# 🚀 StaticJS

**A modern boilerplate for creating static projects**

[![npm version](https://badge.fury.io/js/%40bouygues-telecom%2Fstaticjs.svg)](https://badge.fury.io/js/%40bouygues-telecom%2Fstaticjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

_Start your static projects in seconds with an optimized architecture_

[Installation](#-installation) • [Usage](#-usage) • [Features](#-features) • [Examples](#-examples)

</div>

## 📖 Table of Contents

- [🎯 About](#-about)
- [✨ Features](#-features)
- [🚀 Installation](#-installation)
- [📘 Usage](#-usage)
- [🔄 Revalidation](#-revalidation)
- [⚙️ Configuration](#️-configuration)
- [📚 Examples](#-examples)
- [📄 License](#-license)

## 🎯 About

**StaticJS** is a powerful and modern boilerplate designed for creating static projects. It integrates development best practices and offers advanced features like specific page revalidation.

### Why StaticJS?

- ⚡ **Ultra-fast startup** - Initialize your project in seconds
- 🔄 **Smart revalidation** - Rebuild specific pages on demand
- 🏗️ **Modern architecture** - Optimized and maintainable project structure
- 🚀 **Production ready** - Production-ready configuration
- 📱 **Responsive** - Native support for all devices

## ✨ Features

| Feature                       | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| 🚀 **Fast generation**        | Project creation with a single command         |
| 🔄 **Hot Reloading**          | Automatic reload during development            |
| 📦 **Optimized build**        | Production-optimized bundle                    |
| 🎯 **Targeted revalidation**  | Specific page reconstruction via API           |
| 🛠️ **Flexible configuration** | Advanced customization according to your needs |
| 📊 **Performance**            | Automatic performance optimizations            |

## 🚀 Installation

### Prerequisites

- Node.js >= 16.0.0
- npm >= 7.0.0

### Global installation

```bash
npm i @bouygues-telecom/staticjs -g
```

> 💡 **Tip**: Global installation allows you to use the `create-staticjs-app` command from anywhere on your system.

## 📘 Usage

### 1. Create a new project

```bash
create-staticjs-app
```

This command will:

- 📁 Create the folder structure
- ⚙️ Configure base files
- 📦 Prepare the development environment

### 2. Install dependencies

```bash
cd your-project
npm i
```

### 3. Start development

#### Quick start (recommended)

```bash
npm run dev
```

> 💡 **Note**: The first run may take longer as it automatically builds the project and generates required cache files.

#### Alternative: Build then start

```bash
npm run build
npm run dev
```

🎉 **Your project is now accessible at** `http://localhost:3000` with hot reloading enabled

#### Production build and serve

```bash
npm run start
```

🎉 **Production server accessible at** `http://localhost:3300`

## 🔄 Revalidation

StaticJS offers a unique **targeted revalidation** feature that allows rebuilding specific pages without rebuilding the entire project.

### Custom revalidation handler

Create a `src/revalidate.ts` file to control which pages get rebuilt when `POST /revalidate` is called. The function receives the full Express request and must return a `string[]` of page paths:

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

> 💡 **Tip**: If `src/revalidate.ts` does not exist, StaticJS falls back to reading `req.body.paths` from the request body. Both exports are optional.

### Triggering revalidation

```bash
# The body is forwarded to your src/revalidate.ts handler
curl -X POST http://localhost:3000/revalidate \
  -H "Content-Type: application/json" \
  -d '{ "paths": ["home"] }'
```

## 📚 Examples

#### Revalidate a single page

```bash
curl -X POST http://localhost:3000/revalidate \
  -H "Content-Type: application/json" \
  -d '{ "paths": ["home"] }'
```

#### Revalidate multiple pages

```bash
curl -X POST http://localhost:3000/revalidate \
  -H "Content-Type: application/json" \
  -d '{ "paths": ["home", "partials/page1", "ninja"] }'
```

## ⚙️ Configuration

### Project structure

```
your-project/
├── 📁 src/
│   ├── 📁 pages/          # Your pages
│   ├── 📁 components/     # Reusable components
│   ├── 📁 styles/         # Style files
│   ├── 📁 utils/          # Utilities
│   └── 📄 revalidate.ts   # Custom revalidation handler (optional)
├── 📁 public/             # Static assets
├── 📄 package.json
└── 📄 static.config.ts    # StaticJS configuration
```

## 🛠️ Available scripts

| Script                | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `npm run dev`         | Start development server with hot reloading          |
| `npm run dev:force-build` | Force build then start development server        |
| `npm run validate-setup` | Check if all required files are present           |
| `npm run build`       | Build the project for production                     |
| `npm run start`       | Build and start the production server                |
| `npm run serve`       | Serve pre-built files (requires prior build)         |

### Development Workflow

1. **First time setup**: Run `npm run dev` - it will automatically build if needed
2. **Daily development**: Use `npm run dev` for hot reloading
3. **Troubleshooting**: Run `npm run validate-setup` to check for issues
4. **Force rebuild**: Use `npm run dev:force-build` if cache issues occur

### Hot Reloading

The development server includes **WebSocket-based hot reloading** for:
- ✅ React components (`.tsx`, `.jsx`)
- ✅ TypeScript/JavaScript files (`.ts`, `.js`)
- ✅ CSS and styling changes (`.css`, `.scss`, `.sass`, `.less`)
- ✅ Static assets (images, fonts)
- ✅ Configuration files (triggers full reload)

**Features**:
- 🔄 **Instant reloads** - Changes reflected in < 300ms
- 🎯 **Smart reload types** - CSS changes don't trigger full page reload
- 📍 **Scroll preservation** - Maintains scroll position across reloads
- 🔗 **Auto-reconnection** - Reconnects automatically if connection is lost
- 👁️ **Visual indicators** - Connection status and reload notifications

> 🔧 **Troubleshooting**:
> - Check for green status indicator in top-right corner
> - If hot reloading stops working, try `npm run dev:force-build`
> - Visit `/hot-reload-client.js` to verify client script loads
> - Check browser console for `[HotReload]` messages

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

---

<div align="center">

**Developed with ❤️ by the Bouygues Telecom team**

</div>
