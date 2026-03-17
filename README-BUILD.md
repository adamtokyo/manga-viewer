# Manga Viewer Build System

This project uses **Tailwind CSS CLI** for building optimized CSS files.

## Setup

### Install Dependencies
```bash
npm install
```

## Development

### Watch Mode (Recommended during development)
```bash
npm run dev
```
This will watch for changes in your HTML and CSS files and automatically rebuild `dist/output.css`.

**In VS Code:** Press `Ctrl+Shift+B` and select "Tailwind CSS: Watch & Build"

## Production

### Build Optimized CSS
```bash
npm run build:prod
```
This creates a minified, production-ready CSS file with PurgeCSS optimization (unused styles removed).

**In VS Code:** Press `Ctrl+Shift+B` and select "Tailwind CSS: Build (Production)"

## Project Structure

```
manga-viewer/
├── index.html              # Main HTML file
├── dist/
│   └── output.css         # Generated Tailwind CSS (built by CLI)
├── src/
│   └── input.css          # Source CSS with Tailwind directives
├── package.json           # Project dependencies
├── tailwind.config.js     # Tailwind configuration
└── .gitignore             # Git ignore rules
```

## Workflow

1. **Development:** Run `npm run dev` and keep it running. Make changes to `index.html` and `src/input.css` - CSS will auto-rebuild.
2. **Production Deploy:** Run `npm run build:prod` to generate an optimized, minified CSS file.

## Key Features

- ✅ Tailwind CSS stripped down to only used styles (tree-shaking)
- ✅ Minified output for production
- ✅ Watch mode for development
- ✅ Custom animations and utilities preserved
- ✅ No CDN dependencies

## Customization

Edit `tailwind.config.js` to customize Tailwind theme, add plugins, or configure content scanning paths.

Edit `src/input.css` to add custom CSS using Tailwind layers or standard CSS.
