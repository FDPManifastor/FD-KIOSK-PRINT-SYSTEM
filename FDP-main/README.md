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
- `BACKOFFICE_PASSWORD`: Optional extra password with owner access (for `/backoffice`). Without it, the owner and location keys are used.
- `STATION_TIMER_FOLDERS`: Comma-separated stations that use the time/cost timer. Defaults to all stations.
- `OWNER_ACCESS_KEY`, `ACCESS_KEY_AMSTERDAM`, `ACCESS_KEY_UTRECHT`, `ACCESS_KEY_HOOGVLIET`: secret keys for the owner overview (`/beheer/<key>`) and the location pages (`/locatie/<key>`). If a key is missing it is generated once and stored in `uploads/.access-keys.json`; the links are printed in the server log at start-up. Set them in the host's environment so the links survive redeploys.

## Station timer and auto-guide

- Staff open `/backoffice`, log in and click **Computer vrijgeven** for a station. The kiosk screen of that station then shows the time used and the cost in the bottom-right corner.
- Rate (all stations): EUR 0.95 for the first 10 minutes, then EUR 0.05 per started minute. A station can have its own rate (`stationPricingOverrides` in `index.js`).
- Free session (all stations, `freeSessionFolders`): staff can start a session without time limit or charge (`POST .../start?mode=free`, button "Vrije sessie" in the overview and backoffice). The kiosk shows "Vrije sessie · Vrij", no rate warnings, and the end screen shows no amount.
- At the start of a paid session (first 2 minutes, after the language choice) the timer pop-up shows the rate; one minute before 10 minutes it warns again. The price list has a fixed line for the per-minute rate. The old "Ben je klaar met je sessie?" restart pop-up is switched off (`sessionTimeout: false`).
- Customer self-finish (all stations, `selfFinishFolders`; `kiosk-session.js`): an "Ik ben klaar" button above the timer stops the clock (`POST /station/finish/:folder`) and locks the kiosk for payment at the counter.
- Access: no login is required. `/` and `/backoffice` show and control all stations (the API is open without a key). The location links `/locatie/<key>` show only that location's stations (a location key also limits the API to its own stations); `/beheer/<key>` shows everything plus the location links to share. These links are a convenience filter, not security.
- The overview pages show under every station card the live time and amount, with **Aan**, **Pauze/Hervat** and **Uit**. Paused time is not charged.
- **Stoppen en afrekenen** freezes time and total; the kiosk shows the amount to pay. **Betaald, vrijmaken** clears it.
- Sessions are saved in `uploads/.station-sessions.json`, so a running timer survives a restart when `uploads` is on a persistent disk.
- Lock (all stations, `kiosk-lock.js`): while the station is off or finished, the kiosk shows the price list with "ask a staff member to activate", which cannot be closed, and uploads to that station are refused. Activating removes the lock and clears the previous customer's files.
- Touchscreen mode (all stations, `kiosk-touch.js`): tap a file to preview it, large buttons (Print as main button, Delete separate), large confirm dialogs instead of browser pop-ups, no zoom/text selection/long-press menu, tap feedback and smooth animations.
- Album layout (all stations, `kiosk-album.js`): the instructions column moves into a pop-up opened by a ringing, glowing button; the uploads column is twice as wide and shows files as a thumbnail grid (`/thumb/:folder/:file`, 320 px via sharp, falls back to the original image).
- Language choice (all stations, `kiosk-language.js`): when the computer is activated and the price list disappears, a Dutch/English pop-up appears; the step pop-up follows after the choice. On the phone, an upload to an inactive computer shows a clear "not activated" pop-up.
- Impose (all stations, `kiosk-impose.js`): Passend (in proportion, 5-100%, corner handles, pinch), Vullen (fill; drag to choose the visible part) or Vrij formaat (8 handles; stretch or crop), move by dragging with snap-to-centre, rotate 90°, centre, undo, photo sizes 9x13-20x30 cm (auto-rotate when needed), size on paper in cm, and a 5 mm safe-margin guide. Preview and print share one calculation (`window.FDPImposeStyle`).
- New features are built on the test pages (`files_test_copy1.html`, `upload_test_copy1.html`) first. The station pages are copies of those with only the station name and folder replaced (and without the TEST MODE label), so a change is rolled out by regenerating them from the test pages. Run `python3 tools/rollout_stations.py public` from `FDP-main`.

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