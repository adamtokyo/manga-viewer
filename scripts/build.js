#!/usr/bin/env node

/**
 * Build script: Copies and prepares files for deployment
 * - Copies index.html to dist/ with updated CSS path
 * - Ensures dist/ is a complete deployable directory
 */

const fs = require('fs');
const path = require('path');

// Root is one level up from scripts/
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy and update index.html
const indexSource = path.join(rootDir, 'index.html');
const indexDest = path.join(distDir, 'index.html');

// Read original index.html
let html = fs.readFileSync(indexSource, 'utf-8');

// Update CSS path from ./dist/output.css to ./output.css
html = html.replace('href="./dist/output.css"', 'href="./output.css"');

// Write to dist/index.html
fs.writeFileSync(indexDest, html, 'utf-8');

console.log('✓ Copied index.html to dist/ with updated paths');
console.log(`✓ dist/ is now ready to deploy`);
console.log(`\nDeployable files:`);
console.log(`  - dist/index.html`);
console.log(`  - dist/output.css`);
console.log(`\nNote: Copy your manga images (000.avif, 001.avif, etc.) to dist/`);
