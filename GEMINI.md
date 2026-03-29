# Manga Viewer - AI Assistant Guide

This document contains architectural and context information about the Manga Viewer project to assist Gemini (or other AI assistants) in understanding the codebase for future modifications.

## Project Architecture

The Manga Viewer is a high-performance, touch-friendly, dual-resolution web-based image viewer built with vanilla HTML, CSS (Tailwind), and JavaScript. 

### Core Features
- **Dual Resolution Loading:** Prioritizes fetching smaller `low-XXX.avif` images for immediate feedback and preloads `high-XXX.avif` in the background, transitioning seamlessly using CSS crossfades when the high-res image decodes.
- **Aggressive Caching Engine:** Automatically reads ahead to cache adjacent and future images to ensure zero-latency swiping. Cleans up old images from memory automatically (`imagePool` for recycling DOM objects).
- **Gestures & Controls:** 
  - Supports Pinch-to-zoom, Panning (custom bounding calculations), and dragging/swiping to traverse pages. 
  - Screen divided into Tap Zones (Top: Menu/Fullscreen toggle, Bottom: Rewind to start, Left: Next page, Right: Previous page, Center: Toggle UI visibility).
- **Chapter Skip Menu:** Reads index from `dist/index.json` instantly on load to provide a jump-to-chapter side-drawer menu.

### Technology Stack
- **Frontend Stack:** Vanilla JS (`src/script.js`), HTML5, CSS3.
- **Styling:** TailwindCSS 3 (`src/input.css` compiled to `dist/output.css`).
- **Testing:** Playwright (`tests/integration.spec.js`) to assert full integration functionality and rendering.

## Important Directories & Files
- `/src/script.js`: The heart of the application containing the state, caching queue, animation, and pointer logic.
- `/src/constants.js`: Configuration for timings, cache depths, easings, UI zones, and zoom levels.
- `/index.html`: The main entry skeleton. It heavily utilizes CSS absolute position overlays (`layer-top`, `layer-bottom`) to permit performant swipe transforms.
- `/scripts/build.js`: The build script responsible for taking `src` and generating hashed output files into `/dist` for client cache busting. It also rewrites `<script>` and `<link>` paths in `dist/index.html` and ensures runtime-fetched files like `index.json` path correctly for production.
- `/playwright.config.js`: Configuration specifying that tests run against an `http.server` scoped strictly to the `dist/` directory.

## Development Workflows

### Running Locally
You can run a basic development server using:
```bash
npm run dev
```
(Note: `npm run dev` simply watches tailwind. Generally, the `index.html` can be opened locally via Live Server or similar, but the application relies heavily on `fetch` so it must be run via an HTTP server).

### Building
```bash
npm run build
```
This triggers the linting, tailwind production build, and `scripts/build.js`. After this runs, the `/dist` directory is the completely self-contained deployment package.

### Testing
```bash
npx playwright test
```
Tests interact with a local webserver running on port `3000` mapping to `./dist`. Before running tests, you MUST have run the build script `npm run build` so that `dist/index.html` and assets exist.

> [!IMPORTANT]
> Always run `npm run test` as an extra sanity check after `npm run build` to ensure no regressions were introduced. Note that the Playwright tests take about a minute to complete (as they simulate flipping through all pages), so please be patient with them.

### Deployment & Release
The `./update.sh` script automates pulling the latest `main` branch, running the production build `npm run build:prod`, and syncing the `dist/*` files over to a remote Caddy web root directory.

## Known Gotchas
1. **DOM References vs. Event Loops:** Preloading sets images to `opacity: 0` before making them visible. Avoid modifying opacity directly bypassing the `transitionToHighWhenReady` flows where race conditions exist.
2. **Path Rewriting:** In `src/script.js`, any `fetch` that targets `./dist/asset.json` will be dynamically rewritten during `npm run build` to target `./asset.json`, because in deployment, the `dist` folder *is* the web root. Watch out for these regular expression replacements!
