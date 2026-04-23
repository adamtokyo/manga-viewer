# Manga Viewer

A lightweight, touch-optimized manga/comic viewer built with vanilla JavaScript and Tailwind CSS. Perfect for reading manga or sequential images on mobile and desktop.

## Features

- **Touch Gestures**
  - Swipe left/right to navigate between pages
  - Pinch to zoom in/out
  - Pan around zoomed images
  - Tap zones for navigation and fullscreen

- **Performance**
  - Dual-resolution loading (`low-` res fallback with seamless transition to `high-` res)
  - Aggressive image pooling and cache readahead for zero-latency swiping
  - Instant chapter skip menu using `index.json`
  - Minimal bundle size (~12KB CSS)

- **User Experience**
  - Auto-hide UI with manual toggle
  - Fullscreen mode support
  - Onboarding animation for first-time users
  - Local storage persistence (remembers last page)
  - Keyboard navigation (arrow keys)

- **Developer Friendly**
  - Modular code structure (separated from HTML)
  - Centralized configuration and constants
  - Easy-to-customize build system
  - Single-directory deployment

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Watch mode (auto-rebuild on changes)
npm run dev

# Then open index.html in your browser
```

### Production Build

```bash
# Create deployable dist/ folder
npm run build

# Copy images and index.json to dist/
cp *.avif index.json dist/

# Deploy dist/ folder to your server
```

## Usage

1. Place your manga/comic images in the root directory. You must provide a high and low-resolution version for every page: `high-000.avif`, `low-000.avif`, `high-001.avif`, `low-001.avif`, etc.
2. Create an `index.json` in the root directory to define the chapter skip menu. (e.g., `[{"title": "Chapter 1", "index": 0}, {"title": "Chapter 2", "index": 20}]`)
3. Open `index.html` via a local HTTP server
4. Navigate with:
   - **Swipe/Arrow Keys**: Move between pages
   - **Pinch/Mouse Wheel**: Zoom
   - **Tap top**: Fullscreen toggle
   - **Tap center**: Toggle UI and chapter skip menu
   - **Tap bottom**: Jump to start (if not on first page)

For deployment instructions, see [DEPLOY.md](DEPLOY.md).

## Image Format & Indexing

The viewer uses a **dual-resolution loading strategy** for optimal performance:
- **Format**: AVIF (highly recommended for size), or any format browsers support (JPEG, WebP, PNG)
- **Naming**: You MUST provide two variants of each image:
  - `low-XXX.avif` (e.g. `low-000.avif`): A low-resolution/high-compression version loaded immediately.
  - `high-XXX.avif` (e.g. `high-000.avif`): The full-quality image loaded in the background with a seamless transition.
- **index.json**: Required to power the skip-to-chapter menu.

**Image Recommendations:**
- **Aspect Ratio**: 2:3 (portrait orientation, like a manga page)
- **High Resolution**: 1024×1536 or higher
- **Low Resolution**: 512×768 or lower, highly compressed

## Project Structure

```
manga-viewer/
├── index.html              # Main HTML (development version)
├── src/
│   ├── script.js           # Application logic
│   ├── constants.js        # Configuration and magic numbers
│   └── input.css           # CSS with Tailwind directives
├── dist/                   # Build output (deployable)
│   ├── index.html          # Generated, CSS path updated
│   └── output.css          # Built and minified
├── scripts/
│   └── build.js            # Build/deployment script
├── package.json            # Dependencies
└── tailwind.config.js      # Tailwind configuration
```

## Customization

### Adjust Controls
Edit `src/constants.js`:
- `TIMING`: Animation speeds
- `GESTURES`: Swipe/tap thresholds
- `ZOOM`: Zoom limits
- `UI_ZONES`: Tap zone sizes

### Customize Colors/Styles
Edit `src/input.css` or `tailwind.config.js`

### Change Image Aspect Ratio
Update `IMAGE_RATIO` in `src/constants.js` (default: 2/3 for manga)

## Browser Support

- Chrome/Chromium 60+
- Firefox 55+
- Safari 12+
- Edge 17+

Requires support for:
- CSS Grid / Flexbox
- ES2017 (async/await)
- Fetch API
- LocalStorage

## Build System

**Tailwind CSS CLI** is used for styling:
- Development: Watch mode rebuilds on file changes
- Production: Minified, tree-shaken CSS (~12KB)

See [README-BUILD.md](README-BUILD.md) for build details.

## Development

### Available Commands

```bash
npm run dev              # Watch mode (development)
npm run build            # Build once
npm run build:prod       # Production build
```

### VS Code Integration

Press `Ctrl+Shift+B` to access build tasks:
- "Tailwind CSS: Watch & Build" (auto-run on startup)
- "Tailwind CSS: Build (Production)"
- "Tailwind CSS: One-time Build"

## Architecture

The codebase is organized for maintainability:
- **index.html**: Pure semantic markup (113 lines)
- **src/script.js**: Application logic (526 lines)
- **src/constants.js**: Configuration (75 lines)
- **src/input.css**: Styling (22 lines)

No external dependencies except Tailwind (dev-only).

## Tips

- **First-time users**: Onboarding animation shows up for 5 seconds on first page
- **Large collections**: Images are preloaded intelligently (current + 20 ahead)
- **Mobile**: All gestures are optimized for touch and single-handed use
- **Offline**: Works completely offline (once images are loaded)

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!

---

**Made for manga lovers** 📖
