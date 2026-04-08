# Migraine Tracker

A personal migraine tracking web app hosted on GitHub Pages. All health data is stored in your own Google Drive — nothing is ever sent to any server.

## Features

### Dashboard
- Active incident banner with elapsed time, quick actions (Add Check-in, End Attack, View Details)
- Log New Headache button (always visible)
- Monthly stats strip: attack count, avg pain, avg duration
- Recent incidents list with color-coded pain bars and type badges

### Incident Logging
- **Attack types**: Migraine, Thunderclap, Thunderclap Precursor, Tension, Cluster, Sinus, Cervicogenic, Hemiplegic, Vestibular, plus custom types
- **Time range**: editable start/end for retroactive entry; leave end blank for ongoing attacks
- **Pain location**: interactive head diagrams (front and back views) with selectable zones traced from anatomical reference masks
  - Zones use anatomical naming (viewer's right = patient's left)
  - **Draggable pain pins**: click "Add Pin" to place a red pin, drag to position, double-tap to remove
  - Legacy zone IDs from older data (`front_eye_left`, `front_cheek_left`, etc.) are aliased to current zones and highlight correctly
- **Premonitory symptoms**: predefined + custom warning signs
- **Symptoms**: predefined + custom with inline add
- **Triggers**: predefined + custom with inline add
- **Affected activities**: predefined + custom with inline add (also manageable in Settings)
- **Notes**: free text
- **Location**: optional GPS capture (stored in Drive only)
- **View/Edit mode**: past incidents open in read-only View mode by default; click Edit to modify, Cancel to revert changes

### Check-ins
- Timestamped pain level (1-10 color-coded scale)
- Symptom checkboxes
- Treatment selector with effectiveness rating (Helped / Somewhat / Didn't help / Unsure)
- Free-text note

### Analytics
- **Single Incident**: pain level over time (line chart of check-in timestamps)
- **Calendar**: headache day heatmap (52-week grid, binary coloring — purple = headache day)
- **Triggers**: horizontal bar chart of trigger frequency
- **Treatments**: ranked effectiveness list with % helpful bars
- **Trends**: interactive per-incident pain & duration chart
  - Vertical crosshair line follows mouse cursor
  - Tooltip snaps to nearest incident showing date, pain, duration, and attack type
  - Click any data point to navigate to that incident's detail view

### Export
- **CSV**: doctor-readable format with human-friendly column names (one row per incident)
- **JSON**: full raw data backup

### Settings
- Custom attack types (add/remove)
- Custom affected activities (add/remove)
- Check-in reminder notifications (browser Notification API, configurable interval)
- Import history from JSON file
- Sign out

### Other
- **Auto sign-in**: One Tap silent sign-in with `login_hint` for fast OAuth popup fallback
- **Version stamp**: displayed at bottom of every page and on the sign-in screen
- **Favicon**: brain with lightning bolt (SVG)
- **Responsive / mobile-first**: dark theme, bottom nav on mobile, desktop nav in top bar
- **Cache-busting**: all JS, CSS, SVG, and view HTML fetches include version query params; `index.html` has no-cache meta tags

---

## Setup

### 1. Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project.
2. Enable the **Google Drive API** under _APIs & Services > Library_.
3. Under _APIs & Services > Credentials_, click **Create Credentials > OAuth 2.0 Client ID**.
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
2. Go to _Settings > Pages_ > source: `main` branch, root directory.
3. App will be live at `https://YOUR_USERNAME.github.io/migrainetracker/`.

### 4. First sign-in

On first sign-in the app automatically:
- Creates `MigraineTracker/` in your Google Drive
- Creates `manifest.json` and `settings.json`

Use the Import History feature in Settings to upload existing incident data from a JSON file.

---

## Local development

No build step required. Serve with any static HTTP server:

```bash
# Python 3
python -m http.server 8080
```

Open `http://localhost:8080`. Add this origin to your Cloud Console authorized JavaScript origins.

---

## File structure

```
migrainetracker/
├── index.html              # Single-page shell; Alpine mounts here
├── config.js               # OAuth client ID, version, predefined lists
├── favicon.svg             # Brain + lightning bolt favicon
├── privacy.html            # Privacy policy (required for Google OAuth)
├── .nojekyll               # Prevents GitHub Pages Jekyll processing
│
├── css/
│   ├── main.css            # CSS custom properties, dark theme, layout
│   ├── components.css      # Buttons, cards, modals, head diagram styles
│   └── charts.css          # Chart container sizing
│
├── js/
│   ├── app.js              # Alpine stores, boot sequence, router
│   ├── auth.js             # Google Identity Services + One Tap sign-in
│   ├── drive.js            # Drive API: folder bootstrap, file CRUD
│   ├── manifest.js         # Manifest read/write helpers
│   ├── seed.js             # Default settings factory
│   ├── notifications.js    # Browser Notification API scheduler
│   ├── charts.js           # Chart.js factories (crosshair plugin, trends)
│   ├── export-csv.js       # CSV export generator
│   ├── utils.js            # Date formatting, UUID, helpers
│   └── view-components.js  # Alpine component functions for all views
│
├── views/                  # Loaded via fetch() + x-html by the router
│   ├── dashboard.html
│   ├── log.html            # Incident view/edit (includes head diagram)
│   ├── check-in.html
│   ├── analytics.html
│   └── settings.html
│
├── img/
│   ├── head-front.png      # Front head diagram (470x740, transparent bg)
│   └── head-back.png       # Back head diagram (470x740, transparent bg)
│
└── svg/
    ├── head-front.svg      # Clickable zone overlay (11 regions)
    ├── head-back.svg       # Clickable zone overlay (6 regions)
    └── icons.svg           # SVG sprite
```

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
- [Chart.js v4](https://www.chartjs.org/) — analytics charts with custom crosshair plugin
- [Google Identity Services](https://developers.google.com/identity) — OAuth + One Tap
- [Google Drive API v3](https://developers.google.com/drive/api) — data storage
- Pure CSS dark theme with custom head diagram zone overlays (traced from anatomical mask PNGs)
