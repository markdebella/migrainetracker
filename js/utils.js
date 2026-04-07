// Utility helpers

const Utils = {
  /** Generate a UUID v4 using the native browser API */
  uuid() {
    return crypto.randomUUID();
  },

  /** Format a Date or ISO string as "Mon DD, YYYY" */
  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  /** Format a Date or ISO string as "h:MM AM/PM" */
  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  },

  /** Format a Date or ISO string for datetime-local input (YYYY-MM-DDTHH:MM) */
  toInputDateTime(iso) {
    if (!iso) {
      const now = new Date();
      iso = now.toISOString();
    }
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /** Convert duration in minutes to human-readable "Xh Ym" */
  formatDuration(minutes) {
    if (!minutes && minutes !== 0) return 'Ongoing';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },

  /** Calculate duration in minutes between two ISO strings */
  durationMinutes(startIso, endIso) {
    if (!startIso || !endIso) return null;
    return Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  },

  /** Return elapsed time string from startIso until now */
  elapsed(startIso) {
    if (!startIso) return '';
    const diff = Math.floor((Date.now() - new Date(startIso)) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  },

  /** Return current local ISO string */
  nowISO() {
    return new Date().toISOString();
  },

  /**
   * Debounce a function call.
   * @param {Function} fn
   * @param {number} ms
   */
  debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  },

  /** Deep clone a plain object */
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /** Look up a label from a CONFIG list by id */
  labelFor(list, id) {
    const item = list.find(x => x.id === id);
    return item ? item.label : id;
  },

  /** Convert a list of ids to display labels joined by separator */
  labelsFor(list, ids, sep = ', ') {
    if (!ids || !ids.length) return '';
    return ids.map(id => Utils.labelFor(list, id)).join(sep);
  },

  /** Encode a geohash-like string from lat/lon (simple base32) — only for display */
  geohashApprox(lat, lon) {
    // Very rough approximation — not a real geohash library
    return `${lat.toFixed(3)},${lon.toFixed(3)}`;
  },
};
