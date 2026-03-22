#!/usr/bin/env node

/**
 * Build script: Copies and prepares files for deployment
 * - Copies index.html to dist/ with updated CSS path
 * - Ensures dist/ is a complete deployable directory
 * - Adds hashes to JS/CSS filenames for browser caching
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Root is one level up from scripts/
const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Function to calculate content hash
function getHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Clean up old hashed files in dist (but preserve imagery and other non-built things)
const filesInDist = fs.readdirSync(distDir);
for (const file of filesInDist) {
  if (/^(output|script|constants|favicon)\.[a-f0-9]{8}\.(css|js|png)$/.test(file) || file === 'script.js' || file === 'constants.js') {
    fs.unlinkSync(path.join(distDir, file));
  }
}

// 1. Process CSS (already built to dist/output.css by tailwind)
const cssOriginalDest = path.join(distDir, 'output.css');
let cssHash = '';
if (fs.existsSync(cssOriginalDest)) {
  const cssContent = fs.readFileSync(cssOriginalDest, 'utf-8');
  cssHash = getHash(cssContent);
  const cssHashedDest = path.join(distDir, `output.${cssHash}.css`);
  fs.writeFileSync(cssHashedDest, cssContent, 'utf-8');
  fs.unlinkSync(cssOriginalDest); // remove the unhashed one
} else {
  console.warn('⚠️ output.css not found in dist/. Did tailwind run?');
}

// 2. Process constants.js
const constantsSource = path.join(rootDir, 'src', 'constants.js');
const constantsContent = fs.readFileSync(constantsSource, 'utf-8');
const constantsHash = getHash(constantsContent);
const constantsDest = path.join(distDir, `constants.${constantsHash}.js`);
fs.writeFileSync(constantsDest, constantsContent, 'utf-8');

// 3. Process script.js (and update its import path)
const scriptSource = path.join(rootDir, 'src', 'script.js');
let scriptContent = fs.readFileSync(scriptSource, 'utf-8');
// Update import from './constants.js' to `./constants.${constantsHash}.js`
scriptContent = scriptContent.replace(/['"]\.\/constants\.js['"]/, `'./constants.${constantsHash}.js'`);
const scriptHash = getHash(scriptContent);
const scriptDest = path.join(distDir, `script.${scriptHash}.js`);
fs.writeFileSync(scriptDest, scriptContent, 'utf-8');

// 3.5 Process favicon.png
const faviconSource = path.join(rootDir, 'favicon.png');
let faviconHash = '';
if (fs.existsSync(faviconSource)) {
  const faviconContent = fs.readFileSync(faviconSource); // Read as buffer
  faviconHash = getHash(faviconContent);
  const faviconDest = path.join(distDir, `favicon.${faviconHash}.png`);
  fs.writeFileSync(faviconDest, faviconContent); // Write buffer
}

// 4. Update index.html
const indexSource = path.join(rootDir, 'index.html');
const indexDest = path.join(distDir, 'index.html');
let html = fs.readFileSync(indexSource, 'utf-8');

// Update Favicon path
if (faviconHash) {
  html = html.replace('href="./favicon.png"', `href="./favicon.${faviconHash}.png"`);
}

// Update CSS path from ./dist/output.css to ./output.[hash].css
if (cssHash) {
  html = html.replace('href="./dist/output.css"', `href="./output.${cssHash}.css"`);
} else {
  html = html.replace('href="./dist/output.css"', `href="./output.css"`);
}

// Update JS path from ./src/script.js to ./script.[hash].js
html = html.replace('src="./src/script.js"', `src="./script.${scriptHash}.js"`);

// Write to dist/index.html
fs.writeFileSync(indexDest, html, 'utf-8');

console.log('✓ Build successful with hashed assets:');
if (cssHash) console.log(`  - dist/output.${cssHash}.css`);
console.log(`  - dist/constants.${constantsHash}.js`);
console.log(`  - dist/script.${scriptHash}.js`);
if (faviconHash) console.log(`  - dist/favicon.${faviconHash}.png`);
console.log(`  - dist/index.html`);
console.log(`\nNote: Copy your manga images (000.avif, 001.avif, etc.) to dist/`);
