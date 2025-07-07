# React Template for StaticJS

This is a React template for creating static websites with StaticJS.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server (recommended):
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

4. Start production server:
```bash
npm start
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | 🔥 **New!** Optimized dev server with smart hot reload |
| `npm run watch` | Legacy dev server with nodemon |
| `npm run build` | Production build |
| `npm run start` | Build + production server |

## Project Structure

```
src/
├── pages/          # Your pages (automatically routed)
│   ├── page1.tsx   # Accessible at /page1.html
│   ├── page2.tsx   # Accessible at /page2.html
│   └── page3/
│       └── [id].tsx # Dynamic route with getStaticPaths
├── app.tsx         # Main app component
└── layout.tsx      # Layout component
```

## Features

- 🔥 **Smart Hot Reload** - Intelligent rebuild system with targeted updates
- ⚡ **Fast Development** - Optimized build process for development
- 📦 **Optimized Builds** - Production-ready static files
- 🔄 **Automatic Routing** - File-based routing system
- 📱 **Responsive Ready** - Mobile-first design support
- 🎯 **Targeted Revalidation** - Rebuild specific pages via API

## Development Server

The new development server (`npm run dev`) offers significant improvements:

- **50% faster rebuilds** compared to the legacy system
- **Smart file watching** with debounced rebuilds
- **Hot reload** that actually works without manual refresh
- **Build metrics** and detailed logging
- **Queue system** for handling multiple simultaneous changes

For detailed information about the development server, see [DEV_SERVER.md](./DEV_SERVER.md).

## Creating Pages

### Static Pages

Create a `.tsx` file in `src/pages/`:

```tsx
// src/pages/about.tsx
export default function About() {
  return (
    <div>
      <h1>About Us</h1>
      <p>This is the about page.</p>
    </div>
  );
}
```

### Pages with Data

Use `getStaticProps` to fetch data at build time:

```tsx
// src/pages/blog.tsx
export default function Blog({ data }) {
  return (
    <div>
      <h1>Blog</h1>
      {data.posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}

export async function getStaticProps() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  
  return {
    props: {
      data: { posts }
    }
  };
}
```

### Dynamic Routes

Create dynamic pages using bracket notation:

```tsx
// src/pages/blog/[slug].tsx
export default function BlogPost({ data }) {
  return (
    <div>
      <h1>{data.post.title}</h1>
      <div>{data.post.content}</div>
    </div>
  );
}

export async function getStaticPaths() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  
  return {
    paths: posts.map(post => ({
      params: { slug: post.slug }
    }))
  };
}

export async function getStaticProps({ params }) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`).then(r => r.json());
  
  return {
    props: {
      data: { post }
    }
  };
}
```

## Revalidation API

Rebuild specific pages without rebuilding the entire project:

```bash
# Revalidate a single page
curl -X POST http://localhost:3000/revalidate \
  -H "Content-Type: application/json" \
  -d '{ "paths": ["blog.tsx"] }'

# Revalidate multiple pages
curl -X POST http://localhost:3000/revalidate \
  -H "Content-Type: application/json" \
  -d '{ "paths": ["blog.tsx", "about.tsx"] }'
```

## Configuration

### Vite Configuration

The project uses Vite for building. You can customize the build in `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Your custom configuration
});
```

### Development Server Configuration

Customize the development server in `vite.dev.config.js`:

```javascript
export default defineConfig({
  server: {
    port: 3300,
    host: true,
    open: '/page1.html',
  },
  // Custom plugins and configuration
});
```

## Troubleshooting

### Common Issues

1. **Hot reload not working**: Make sure you're using `npm run dev` instead of `npm run watch`
2. **Build errors**: Check the console for TypeScript or build errors
3. **Port conflicts**: Change the port in `vite.dev.config.js` if 3300 is occupied

### Getting Help

- Check the [DEV_SERVER.md](./DEV_SERVER.md) for development server details
- Review the console logs for error messages
- Ensure all dependencies are installed with `npm install`

---

**Built with ❤️ using StaticJS**
