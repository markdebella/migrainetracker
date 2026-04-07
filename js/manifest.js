/**
 * manifest.js — Manifest helpers
 * Keeps Alpine's in-memory manifest in sync with Drive.
 */

const Manifest = {
  /** Build a manifest summary entry from a full incident object */
  entryFrom(incident) {
    return {
      id: incident.id,
      startTime: incident.startTime,
      endTime: incident.endTime,
      isActive: incident.isActive,
      type: incident.type,
      peakPainLevel: incident.peakPainLevel,
      durationMinutes: incident.durationMinutes,
    };
  },

  /** Add or update an entry in the in-memory manifest and persist to Drive */
  async upsert(incident) {
    const store    = Alpine.store('data');
    const manifest = store.manifest;
    const entry    = Manifest.entryFrom(incident);
    const idx      = manifest.incidents.findIndex(i => i.id === incident.id);
    if (idx >= 0) {
      manifest.incidents[idx] = entry;
    } else {
      manifest.incidents.unshift(entry); // newest first
    }
    store.manifest = { ...manifest }; // trigger Alpine reactivity
    await Drive.saveManifest(manifest);
  },

  /** Remove an incident from the manifest and persist */
  async remove(id) {
    const store    = Alpine.store('data');
    const manifest = store.manifest;
    manifest.incidents = manifest.incidents.filter(i => i.id !== id);
    store.manifest = { ...manifest };
    await Drive.saveManifest(manifest);
  },

  /** Return the active incident entry (or null) */
  activeEntry() {
    const manifest = Alpine.store('data').manifest;
    return manifest?.incidents?.find(i => i.isActive) ?? null;
  },

  /** Sort manifest entries newest-first (mutates in place) */
  sortNewest(manifest) {
    manifest.incidents.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  },
};
