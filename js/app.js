/**
 * app.js — Alpine.js global stores, router, and app boot sequence
 *
 * Boot order:
 *  1. Alpine stores initialized (before Alpine starts)
 *  2. Auth.init() — sets up GIS token client, loads GAPI
 *  3. User clicks Sign In → Auth.signIn() → token received
 *  4. App.onSignedIn() — bootstrap Drive folder, load manifest + settings
 *  5. Router navigates to #dashboard
 */

// ── Stores ────────────────────────────────────────────────────────────────────

document.addEventListener('alpine:init', () => {

  Alpine.store('auth', {
    status: 'signed_out',   // 'signed_out' | 'signing_in' | 'signed_in'
    gapiReady: false,
    user: null,             // { name, email, picture } — populated from Google ID token if available
  });

  Alpine.store('data', {
    manifest: null,         // { version, updatedAt, incidents: [...] }
    settings: null,         // user settings object
    activeIncident: null,   // full incident object if currently editing/viewing
    allIncidents: null,     // cached full list (used by analytics)
    loading: false,
    loadingMessage: '',
    error: null,
  });

  Alpine.store('ui', {
    activeView: 'dashboard',
    navOpen: false,
    toast: null,            // { message, type: 'success'|'error'|'info' }
    toastTimer: null,
  });

});

// ── Toast helper ──────────────────────────────────────────────────────────────

const Toast = {
  show(message, type = 'info', duration = 3500) {
    const ui = Alpine.store('ui');
    clearTimeout(ui.toastTimer);
    ui.toast = { message, type };
    ui.toastTimer = setTimeout(() => { ui.toast = null; }, duration);
  },
  success(msg) { Toast.show(msg, 'success'); },
  error(msg)   { Toast.show(msg, 'error', 5000); },
  info(msg)    { Toast.show(msg, 'info'); },
};

// ── Router ────────────────────────────────────────────────────────────────────

const Router = {
  /**
   * Navigate to a view.
   * @param {string} view  e.g. 'dashboard', 'log', 'check-in', 'analytics', 'settings'
   * @param {Object} params  e.g. { id: 'incident-uuid' }
   */
  go(view, params = {}) {
    const ui = Alpine.store('ui');
    ui.navOpen = false;
    ui.activeView = view;
    ui.routeParams = params;
    window.location.hash = params.id ? `${view}/${params.id}` : view;
    window.scrollTo(0, 0);
  },

  /** Parse the current hash into { view, id } */
  parse() {
    const hash   = window.location.hash.replace('#', '') || 'dashboard';
    const parts  = hash.split('/');
    return { view: parts[0], id: parts[1] ?? null };
  },

  /** Restore state from the URL hash (used on page load) */
  restore() {
    const { view, id } = Router.parse();
    const ui = Alpine.store('ui');
    ui.activeView  = view;
    ui.routeParams = id ? { id } : {};
  },
};

window.addEventListener('hashchange', () => Router.restore());

// ── Incident factory ──────────────────────────────────────────────────────────

const IncidentFactory = {
  blank() {
    return {
      id: Utils.uuid(),
      version: 1,
      createdAt: Utils.nowISO(),
      updatedAt: Utils.nowISO(),
      type: 'migraine',
      customTypeName: null,
      startTime: Utils.nowISO(),
      endTime: null,
      isActive: false,
      location: { lat: null, lon: null, accuracy: null },
      painLocations: {
        front: { regions: [], pins: [] },
        back:  { regions: [], pins: [] },
        left:  { regions: [], pins: [] },
        right: { regions: [], pins: [] },
      },
      premonitorySymptoms: [],
      symptoms: [],
      triggers: [],
      affectedActivities: [],
      notes: '',
      checkIns: [],
      peakPainLevel: null,
      durationMinutes: null,
    };
  },

  /** Compute and store peakPainLevel and durationMinutes before closing */
  finalize(incident) {
    const levels = incident.checkIns.map(c => c.painLevel).filter(Boolean);
    incident.peakPainLevel = levels.length ? Math.max(...levels) : null;
    if (incident.startTime && incident.endTime) {
      incident.durationMinutes = Utils.durationMinutes(incident.startTime, incident.endTime);
    }
    return incident;
  },
};

// ── App bootstrap ─────────────────────────────────────────────────────────────

const App = {
  /** Called by auth.js after a token is successfully received */
  async onSignedIn() {
    const data = Alpine.store('data');
    data.loading = true;
    data.loadingMessage = 'Connecting to your Drive…';

    try {
      // Ensure folder exists
      await Drive.bootstrapFolder();

      // Load manifest (or create empty one on first run)
      data.loadingMessage = 'Loading your history…';
      const manifest = await Drive.loadManifest();
      if (manifest) {
        Manifest.sortNewest(manifest);
        data.manifest = manifest;
      } else {
        // First run — create empty manifest
        const emptyManifest = { version: 1, updatedAt: Utils.nowISO(), incidents: [] };
        await Drive.saveManifest(emptyManifest);
        data.manifest = emptyManifest;
        Toast.success('Welcome! Start logging your first headache.');
      }

      // Load settings (or create defaults on first run)
      const settings = await Drive.loadSettings();
      if (settings) {
        data.settings = settings;
      } else {
        const defaults = DefaultSettings.get();
        await Drive.saveSettings(defaults);
        data.settings = defaults;
      }

      // Initialize notifications module
      Notifications.init();

      // Navigate to dashboard
      Router.go('dashboard');
    } catch (err) {
      console.error('Bootstrap error:', err);
      Toast.error('Could not connect to Google Drive. Please try again.');
      Alpine.store('auth').status = 'signed_out';
    } finally {
      data.loading = false;
      data.loadingMessage = '';
    }
  },

  /** Save an incident, update manifest, show toast */
  async saveIncident(incident, opts = {}) {
    const { silent = false, close = false } = opts;
    const data = Alpine.store('data');

    if (close) {
      incident.endTime  = incident.endTime || Utils.nowISO();
      incident.isActive = false;
      IncidentFactory.finalize(incident);
    }

    try {
      await Drive.saveIncident(incident);
      await Manifest.upsert(incident);
      data.activeIncident = incident;
      if (!silent) Toast.success(close ? 'Incident closed.' : 'Saved.');
    } catch (err) {
      console.error('Save error:', err);
      Toast.error('Could not save. Check your connection.');
    }
  },

  /** Delete an incident and remove it from the manifest */
  async deleteIncident(id) {
    try {
      await Drive.deleteIncident(id);
      await Manifest.remove(id);
      Toast.success('Incident deleted.');
      Router.go('dashboard');
    } catch (err) {
      console.error('Delete error:', err);
      Toast.error('Could not delete. Check your connection.');
    }
  },

  /** Load full analytics data (all incidents) */
  async loadAllForAnalytics() {
    const data = Alpine.store('data');
    if (data.allIncidents) return data.allIncidents; // use cache
    data.loading = true;
    data.loadingMessage = 'Loading full history for analytics…';
    try {
      const all = await Drive.loadAllIncidents(data.manifest);
      data.allIncidents = all;
      return all;
    } finally {
      data.loading = false;
      data.loadingMessage = '';
    }
  },
};

// ── Autosave helper ───────────────────────────────────────────────────────────

const AutoSave = {
  _save: null,

  /** Call this with the incident object; saves to Drive after 30s of inactivity */
  queue(incident) {
    if (!AutoSave._save) {
      AutoSave._save = Utils.debounce(async (inc) => {
        try {
          await Drive.saveIncident(inc);
          await Manifest.upsert(inc);
        } catch (e) {
          console.warn('Autosave failed:', e);
        }
      }, 30000);
    }
    AutoSave._save(incident);
  },
};

// ── Boot ──────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  Auth.init();
});
