# Belphia Autonomous Landing Page

React + Vite + Tailwind build for the Belphia Autonomous service. The repo contains source code plus a `docs/` directory that holds the compiled site for GitHub Pages.

## Local development

```bash
npm install
npm run dev
```

## Build & deploy

```bash
npm run build
```

The postbuild hook copies `dist/` into `docs/`, so GitHub Pages (configured to serve from `/docs`) always has the latest bundle. Railway or any other host can deploy from the standard Vite `dist/` output.

## Tech stack

- React 19 + Vite 7
- Tailwind CSS 3
- Fully static site (no runtime server required)

Feel free to adapt sections, metrics, or CTA links inside `src/App.jsx`.
