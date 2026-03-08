# Free Favicon Builder

Free Favicon Builder is a completely free, code-generated favicon creation tool built with React, Vite, TypeScript, and Tailwind CSS.

It does **not** use AI models, paid APIs, or proprietary generation services.

## Features

- Text and letter favicon generation
- Shape-based favicon generation
- Programmatic SVG rendering
- Pattern/style presets: minimal, gradient, neon, glass, retro, pixel, outlined, solid, shadowed
- Icon library for common developer symbols
- Live previews for browser tabs, bookmarks, mobile, and desktop icons
- Multi-size favicon export
- Download support for SVG, PNG, favicon.ico, and ZIP packages
- Browser-only generation pipeline with caching
- SEO-friendly landing-page routes

## Tech Stack

### Frontend
- React
- Vite
- TypeScript
- Tailwind CSS

### Client-side generation
- Custom SVG engine
- Canvas-based PNG rasterization
- ICO bundle generation in the browser
- JSZip for package downloads

## Current Implementation Notes

This repository currently ships as a single Vite application that demonstrates the full product experience in one deployable frontend.

The UI includes the architectural blueprint for scaling into the following monorepo layout:

```txt
/apps
  /web
  /api
/packages
  /favicon-engine
  /svg-engine
  /icon-library
  /download-engine
```

## Recommended Scalable Monorepo Structure

```txt
/apps
  /web                 # React/Next.js frontend
  /api                 # Fastify backend for server-side Sharp rendering
/packages
  /svg-engine          # SVG generation for shapes, text, gradients, patterns
  /icon-library        # Open-source symbol collection and wrappers
  /favicon-engine      # SVG -> PNG -> ICO pipeline
  /download-engine     # ZIP + manifest generation
```

## How It Works

1. User selects text or an icon
2. User picks shape, colors, border, and style preset
3. A custom SVG string is generated in memory
4. The SVG is previewed instantly using a data URL
5. PNG exports are generated through the canvas API
6. `favicon.ico` is built by packaging multiple PNG sizes into a valid ICO file
7. ZIP downloads are assembled using JSZip

## Exported Assets

- `favicon.svg`
- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-48x48.png`
- `favicon-64x64.png`
- `favicon-128x128.png`
- `favicon-256x256.png`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `site.webmanifest`

## SEO Landing Pages

The app supports the following landing-page routes:

- `/favicon-generator`
- `/favicon-maker`
- `/free-favicon-generator`
- `/favicon-builder`

These routes are handled client-side and should be deployed with SPA fallback rewrites.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Deployment Instructions

### Vercel

- Import the repository into Vercel
- Use the default Vite build command: `npm run build`
- Output directory: `dist`
- Add rewrite rules so custom landing-page routes fall back to `index.html`

Suggested rewrite behavior:
- `/(.*)` -> `/index.html`

### Cloudflare Pages

- Connect the repository
- Build command: `npm run build`
- Build output directory: `dist`
- Enable SPA fallback so all supported routes resolve to `index.html`

### Docker

Use a multi-stage build that compiles the app and serves the static output.

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

If you need SPA rewrites for custom routes, add an Nginx config that falls back to `index.html`.

### Self Hosted

- Build the project with `npm run build`
- Serve `dist/` using Nginx, Caddy, Apache, or a Node static server
- Ensure unknown routes return `index.html`

## Future Backend Expansion

To match the full platform brief exactly, add:

- `apps/api` using Fastify
- `sharp` for high-fidelity server-side rendering
- package-based shared engines for SVG, favicon, icons, and downloads
- persistent caching layer (memory, Redis, or edge cache)

## Open Source Direction

This project is suitable for an MIT-licensed open-source release.

Suggested community additions:
- more icon packs
- theme presets
- project import/export
- manifest editor
- batch generation
- API endpoints for CI/CD pipelines

## License

Recommended: MIT
