# Migraine Tracker

A personal migraine tracking web app hosted on GitHub Pages. All health data is stored in your own Google Drive — nothing is ever sent to any server.

## Features

- **Dashboard** — active incident banner, recent history, monthly stats
- **Incident logging** — attack type, time range (retroactive entry supported), pain locations via interactive SVG head diagrams (front/left/right/back views), symptoms, triggers, affected activities, notes, optional GPS location
- **Mid-attack check-ins** — add timestamped check-ins with pain level, symptoms, treatments, and notes
- **Treatment tracking** — predefined list + custom, with effectiveness rating per use
- **Analytics** — pain timeline per incident, frequency calendar heatmap, trigger frequency chart, treatment effectiveness rankings, pain & duration trends over time
- **Export** — doctor-readable CSV, full JSON backup
- **Notifications** — optional browser notifications to remind you to log check-ins during an active attack
- **Dark mode native, mobile-first**

---

## Setup

### 1. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project.
2. Enable the **Google Drive API** under _APIs & Services → Library_.
3. Under _APIs & Services → Credentials_, click **Create Credentials → OAuth 2.0 Client ID**.
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `https://YOUR_GITHUB_USERNAME.github.io`
     - `http://localhost:8080` (optional, for local dev)
4. Configure the **OAuth consent screen**:
   - User type: External
   - Add your email as a Test user
   - Scopes: `https://www.googleapis.com/auth/drive.file`
5. Copy your **Client ID** (format: `XXXXXXX.apps.googleusercontent.com`).

### 2. Configure the app

Edit `config.js` and replace the placeholder:

```js
const CONFIG = {
  clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  // ...
};
```

### 3. GitHub Pages

1. Push this repository to GitHub.
2. Go to _Settings → Pages_ → source: `main` branch, root directory.
3. App will be live at `https://YOUR_USERNAME.github.io/migrainetracker/`.

### 4. First sign-in

On first sign-in the app automatically:
- Creates `MigraineTracker/` in your Google Drive
- Uploads your historical incident data from `data/seed-incidents.json`
- Creates `manifest.json` and `settings.json`

Your history is visible immediately.

---

## Local development

No build step required. Serve with any static HTTP server:

```bash
# Python 3
python -m http.server 8080
```

Open `http://localhost:8080`. Add this origin to your Cloud Console authorized JavaScript origins.

---

## Data structure

All data lives in `MigraineTracker/` in your Google Drive:

```
MigraineTracker/
├── manifest.json           # Lightweight index of all incidents
├── settings.json           # App preferences and custom lists
├── incident-{uuid}.json    # One file per incident (full detail)
```

You can view, download, or delete these files from Google Drive at any time.

---

## Privacy

See [privacy.html](privacy.html). Your data never leaves your Google Drive.

---

## Tech stack

- [Alpine.js v3](https://alpinejs.dev/) — reactivity, no build step
- [Chart.js v4](https://www.chartjs.org/) — analytics charts
- [Google Identity Services](https://developers.google.com/identity) — OAuth
- [Google Drive API v3](https://developers.google.com/drive/api) — data storage
- Pure CSS with custom SVG head diagrams
