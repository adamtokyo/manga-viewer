# Deployment Guide

## Quick Deploy

After making changes, deploy with these steps:

### 1. Build
```bash
npm run build
```

This generates a complete deployable `dist/` folder containing:
- `dist/index.html` (copied from root with updated CSS path)
- `dist/output.css` (minified, built Tailwind CSS)

### 2. Add Images
Copy your manga image files to `dist/`:
```bash
cp 000.avif 001.avif 002.avif ... dist/
```

Or organize them in a subdirectory:
```bash
cp -r images/* dist/
```

### 3. Deploy
Simply copy the entire `dist/` folder to your hosting:
```bash
# Example: Deploy to a web server
scp -r dist/* user@example.com:/var/www/manga-viewer/

# Or: Copy to S3
aws s3 sync dist/ s3://my-bucket/manga-viewer/

# Or: Copy to any other hosting
cp -r dist/* /path/to/hosting/
```

## Project Structure

```
manga-viewer/              (source, not deployed)
├── index.html             (source file)
├── src/
│   ├── script.js
│   ├── constants.js
│   └── input.css
└── dist/                  (DEPLOY THIS FOLDER)
    ├── index.html         (auto-generated, ready to serve)
    ├── output.css         (auto-generated)
    ├── 000.avif           (copy manually)
    ├── 001.avif           (copy manually)
    └── ...
```

## CI/CD Integration

For automated deployment, add to your CI/CD pipeline:

```bash
# Build
npm run build

# Copy images (adjust path as needed)
cp *.avif dist/

# Deploy dist/ folder
# (use your hosting's deploy command)
```

## Server Configuration

If deploying to a traditional web server, ensure:
- `dist/` is served as the root directory
- Resources load correctly (CSS, JS, images in same directory)
- No special rewrite rules needed

### Example: Nginx
```nginx
server {
    listen 80;
    server_name manga-viewer.example.com;
    root /var/www/manga-viewer;
    index index.html;
}
```

### Example: Apache
```apache
<Directory /var/www/manga-viewer>
    DirectoryIndex index.html
</Directory>
```

## Development vs Deployment

| File | Location | Purpose |
|------|----------|---------|
| `index.html` | root | Source file (not deployed) |
| `src/` | root | Source code (not deployed) |
| `dist/index.html` | dist/ | Deployed file (CSS path updated) |
| `dist/output.css` | dist/ | Deployed CSS (minified, tree-shaken) |
| `*.avif` images | dist/ | Deployed images |

## Notes

- `dist/index.html` has CSS path updated to `./output.css` (relative to dist/)
- Root `index.html` keeps original path `./dist/output.css` (for local development)
- All images are served from the same directory as `index.html` in deployed env
- No build step needed on server; `dist/` is ready to serve immediately
