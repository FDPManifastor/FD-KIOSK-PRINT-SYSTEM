# FDP

Express app for the FD Printing Center upload workflow.

## Local run

```bash
npm install
npm start
```

The app listens on `PORT` and stores uploads in `UPLOADS_ROOT`.

## Environment variables

- `PORT`: HTTP port. Defaults to `3000`.
- `HOST`: Bind address. Defaults to `0.0.0.0`.
- `UPLOADS_ROOT`: Base directory for uploaded files. Defaults to `./uploads`.

## Docker

Build and run locally:

```bash
docker build -t fdp .
docker run --rm -p 3000:3000 -v "$(pwd)/uploads:/data/uploads" fdp
```

## Deploy live

This app needs a Node host or container host. GitHub Pages is not suitable because the app has server routes and file uploads.

Recommended deployment targets:

1. Render web service using the included `Dockerfile`.
2. Railway using the included `Dockerfile`.
3. Fly.io or any VPS that can run Docker and mount persistent storage.

Important production note:

- Uploads must be stored on a persistent disk mounted at `/data/uploads` or another path passed via `UPLOADS_ROOT`.
- The secure ownership/access maps are kept in memory and reset on restart. Public upload, list, preview, download, and delete routes continue to work after restart, but active secure session links do not persist.

## Health check

Use `/healthz` for a simple readiness check.