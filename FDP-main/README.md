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
- `BACKOFFICE_PASSWORD`: Password for the backoffice at `/backoffice`. Without it the backoffice is open to anyone with the link (temporary, for testing) and shows a warning. Set it before enabling the timer on real stations.
- `STATION_TIMER_FOLDERS`: Comma-separated stations that use the time/cost timer. Defaults to `test_copy1`.

## Station timer and auto-guide

- Staff open `/backoffice`, log in and click **Computer vrijgeven** for a station. The kiosk screen of that station then shows the time used and the cost in the bottom-right corner.
- Rate: EUR 0.95 for the first 10 minutes, then EUR 0.95 per started 5 minutes.
- **Stoppen en afrekenen** freezes time and total; the kiosk shows the amount to pay. **Betaald, vrijmaken** clears it.
- Sessions are saved in `uploads/.station-sessions.json`, so a running timer survives a restart when `uploads` is on a persistent disk.
- To roll out to another station: add the folder to `STATION_TIMER_FOLDERS` and add `<script src="/station-timer.js"></script>` and `<script src="/kiosk-guide.js"></script>` at the end of its `files_*.html` page.

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