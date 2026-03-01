# StaticJS CLI Commands

The StaticJS library now provides beautiful, simplified CLI commands for building and serving your static React applications.

## Available Commands

### `static build`
Builds your static site for production.

```bash
static build
```

This command:
1. 🔨 Builds static HTML files from your TSX components
2. 📦 Builds assets with Vite
3. 🧹 Cleans up temporary cache files

### `static dev`
Starts the development server with hot reload.

```bash
static dev
```

Options:
- `-v, --verbose`: Show all request logs (Vite internals, bundled assets, browser probes). Without this flag, only page-level requests are logged.

Examples:
```bash
static dev              # Quiet logs (page requests only)
static dev --verbose    # Full request logs
```

This command starts a development server with:
- Hot module replacement
- File watching
- Live reload

### `static start`
Serves the built static files in production mode.

```bash
static start
```

Options:
- `-p, --port <port>`: Port to serve on (default: 3456)
- `-h, --host <host>`: Host to serve on (default: localhost)

Examples:
```bash
static start                    # Serve on localhost:3456
static start -p 8080           # Serve on localhost:8080
static start -h 0.0.0.0 -p 80  # Serve on all interfaces, port 80
```

## Package.json Integration

### Option 1: Using Direct Paths (Recommended for Development)

```json
{
  "scripts": {
    "dev": "node ../../lib/_build/scripts/cli.js dev",
    "build": "node ../../lib/_build/scripts/cli.js build",
    "start": "node ../../lib/_build/scripts/cli.js start"
  }
}
```

### Option 2: Using Global Commands (After Package Installation)

```json
{
  "scripts": {
    "dev": "static dev",
    "build": "static build",
    "start": "static start"
  }
}
```

## Development Setup

For development, you have two options:

### Option A: Use Direct Paths (Current Setup)
The templates/react/package.json is already configured to use direct paths to the CLI script. This works immediately without any setup.

### Option B: Link the Package Locally
Run the setup script to link the package globally:

```bash
node setup-dev.js
```

This will:
1. Build the lib package
2. Link it globally with `npm link`
3. Link it in the template project
4. Enable using `static` commands directly

## How It Works

The CLI automatically:
- 🔍 Finds your project root by looking for `package.json`
- 📁 Uses dynamic paths that work regardless of where the package is installed
- 🛠️ Configures Vite and build tools with the correct paths
- 🌐 Serves built files with proper caching headers

## Migration from Old Commands

### Before:
```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx server.js",
    "build": "node ../../lib/_build/scripts/cli.js build",
    "start": "npx http-server -c-1 -p 3456 -a localhost _build"
  }
}
```

### After:
```json
{
  "scripts": {
    "dev": "static dev",
    "build": "static build",
    "start": "static start"
  }
}
```

Much cleaner! 🎉