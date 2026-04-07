/**
 * drive.js — All Google Drive API interactions
 *
 * Uses the GAPI client (already initialized in auth.js).
 * All files live inside a single folder in the user's Drive.
 *
 * File layout inside MigraineTracker/:
 *   manifest.json          — lightweight index of all incidents
 *   settings.json          — user preferences and custom lists
 *   incident-{uuid}.json   — one file per incident
 */

const Drive = (() => {
  const FOLDER_NAME = CONFIG.driveFolderName;
  const MIME_JSON   = 'application/json';
  const MIME_FOLDER = 'application/vnd.google-apps.folder';

  let folderId = localStorage.getItem('mt_folder_id') || null;

  // ── Internal helpers ────────────────────────────────────────────────────────

  async function request(method, path, params = {}, body = null) {
    const req = { method, path, params };
    if (body !== null) {
      req.headers = { 'Content-Type': MIME_JSON };
      req.body    = JSON.stringify(body);
    }
    const response = await gapi.client.request(req);
    return response.result;
  }

  async function multipartUpload(metadata, content, fileId = null) {
    const boundary  = '-------mt_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${MIME_JSON}\r\n\r\n` +
      JSON.stringify(content) +
      closeDelimiter;

    const path  = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}`
      : 'https://www.googleapis.com/upload/drive/v3/files';
    const method = fileId ? 'PATCH' : 'POST';

    const response = await gapi.client.request({
      method,
      path,
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body,
    });
    return response.result;
  }

  async function downloadFile(id) {
    const response = await gapi.client.request({
      method: 'GET',
      path: `https://www.googleapis.com/drive/v3/files/${id}`,
      params: { alt: 'media' },
    });
    // response.result may already be parsed if JSON; otherwise parse it
    if (typeof response.result === 'object') return response.result;
    return JSON.parse(response.body);
  }

  async function findFile(name, parentId = null) {
    const q = parentId
      ? `name='${name}' and '${parentId}' in parents and trashed=false`
      : `name='${name}' and trashed=false`;
    const result = await request('GET', 'https://www.googleapis.com/drive/v3/files', {
      q,
      spaces: 'drive',
      fields: 'files(id,name)',
      pageSize: 1,
    });
    return result.files?.[0] ?? null;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  return {
    // ── Folder bootstrap ──────────────────────────────────────────────────────

    /** Ensure the MigraineTracker folder exists; cache its ID. */
    async bootstrapFolder() {
      if (folderId) return folderId;

      const existing = await findFile(FOLDER_NAME);
      if (existing) {
        folderId = existing.id;
      } else {
        const result = await request('POST', 'https://www.googleapis.com/drive/v3/files', {}, {
          name: FOLDER_NAME,
          mimeType: MIME_FOLDER,
        });
        folderId = result.id;
      }
      localStorage.setItem('mt_folder_id', folderId);
      return folderId;
    },

    getFolderId() { return folderId; },

    /** Return true if the MigraineTracker folder is empty (no files at all). */
    async folderIsEmpty() {
      const result = await request('GET', 'https://www.googleapis.com/drive/v3/files', {
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id)',
        pageSize: 1,
      });
      return (result.files?.length ?? 0) === 0;
    },

    // ── Manifest ──────────────────────────────────────────────────────────────

    async loadManifest() {
      const file = await findFile('manifest.json', folderId);
      if (!file) return null;
      return await downloadFile(file.id);
    },

    async saveManifest(manifest) {
      manifest.updatedAt = Utils.nowISO();
      const file = await findFile('manifest.json', folderId);
      if (file) {
        await multipartUpload({ name: 'manifest.json' }, manifest, file.id);
      } else {
        await multipartUpload({ name: 'manifest.json', parents: [folderId] }, manifest);
      }
    },

    // ── Settings ──────────────────────────────────────────────────────────────

    async loadSettings() {
      const file = await findFile('settings.json', folderId);
      if (!file) return null;
      return await downloadFile(file.id);
    },

    async saveSettings(settings) {
      const file = await findFile('settings.json', folderId);
      if (file) {
        await multipartUpload({ name: 'settings.json' }, settings, file.id);
      } else {
        await multipartUpload({ name: 'settings.json', parents: [folderId] }, settings);
      }
    },

    // ── Incidents ─────────────────────────────────────────────────────────────

    async loadIncident(id) {
      const name = `incident-${id}.json`;
      const file = await findFile(name, folderId);
      if (!file) throw new Error(`Incident ${id} not found`);
      return await downloadFile(file.id);
    },

    async saveIncident(incident) {
      incident.updatedAt = Utils.nowISO();
      const name = `incident-${incident.id}.json`;
      const file = await findFile(name, folderId);
      if (file) {
        await multipartUpload({ name }, incident, file.id);
      } else {
        await multipartUpload({ name, parents: [folderId] }, incident);
      }
    },

    async deleteIncident(id) {
      const name = `incident-${id}.json`;
      const file = await findFile(name, folderId);
      if (file) {
        await request('DELETE', `https://www.googleapis.com/drive/v3/files/${file.id}`);
      }
    },

    /** Load all full incident objects (used by analytics). Throttled to avoid rate limits. */
    async loadAllIncidents(manifest) {
      const results = [];
      for (const entry of manifest.incidents) {
        try {
          const incident = await this.loadIncident(entry.id);
          results.push(incident);
        } catch (e) {
          console.warn(`Could not load incident ${entry.id}:`, e);
        }
        await new Promise(r => setTimeout(r, 150)); // gentle throttle
      }
      return results;
    },

    // ── Batch write (seeder) ──────────────────────────────────────────────────

    /** Write an array of incidents to Drive with a delay between writes. */
    async batchWriteIncidents(incidents, onProgress) {
      for (let i = 0; i < incidents.length; i++) {
        await this.saveIncident(incidents[i]);
        if (onProgress) onProgress(i + 1, incidents.length);
        await new Promise(r => setTimeout(r, 200));
      }
    },
  };
})();
