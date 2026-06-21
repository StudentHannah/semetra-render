# Semetra Render Deployment

This repository is prepared for a single Render Web Service.

## What Render should run

Build command:

```bash
npm run install:all && npm run build
```

Start command:

```bash
npm start
```

## How it works

- `frontend/` contains the Angular app.
- `backend/` contains the Express API.
- The build script builds Angular and copies the generated files into `backend/public`.
- Express serves both `/api/...` and the Angular frontend from one URL.

This keeps the app simple for sharing: one Render link is enough.

## Important

Do not commit `node_modules`.

Render installs dependencies on Linux. Locally copied Windows `node_modules` will break Angular because native packages such as `esbuild` are platform-specific.
