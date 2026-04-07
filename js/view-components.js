/**
 * view-components.js — Alpine component data functions for all views
 *
 * These are loaded statically (not via x-html) so they execute properly.
 * Each view's x-data attribute references one of these functions by name.
 */

// ── Head Diagram ─────────────────────────────────────────────────────────────

function HeadDiagram() {
  return {
    views: [
      { key: 'front', label: 'Front' },
      { key: 'left',  label: 'Left' },
      { key: 'right', label: 'Right' },
      { key: 'back',  label: 'Back' },
    ],
    svgContent: { front: '', back: '', left: '', right: '' },
    svgLoaded: { front: false, back: false, left: false, right: false },

    regionLabels: {
      front_forehead_center: 'Center Forehead', front_forehead_left: 'Left Forehead', front_forehead_right: 'Right Forehead',
      front_temple_left: 'Left Temple', front_temple_right: 'Right Temple',
      front_eye_left: 'Left Eye', front_eye_right: 'Right Eye', front_nose: 'Nose/Sinus',
      front_cheek_left: 'Left Cheek', front_cheek_right: 'Right Cheek',
      front_jaw_left: 'Left Jaw', front_jaw_right: 'Right Jaw', front_chin: 'Chin', front_crown: 'Crown',
      back_crown: 'Crown', back_occipital_left: 'Left Occipital', back_occipital_right: 'Right Occipital',
      back_occipital_center: 'Center Occipital', back_ear_left: 'Left Ear', back_ear_right: 'Right Ear',
      back_neck_left: 'Left Neck', back_neck_right: 'Right Neck', back_neck_center: 'Center Neck',
      back_lower_skull: 'Lower Skull (L)', back_lower_skull_right: 'Lower Skull (R)',
      left_crown: 'Crown', left_forehead: 'Forehead', left_temple: 'Temple', left_eye: 'Eye',
      left_cheek: 'Cheek', left_nose: 'Nose', left_ear: 'Ear', left_jaw: 'Jaw/TMJ', left_occipital: 'Occipital', left_neck: 'Neck',
      right_crown: 'Crown', right_forehead: 'Forehead', right_temple: 'Temple', right_eye: 'Eye',
      right_cheek: 'Cheek', right_nose: 'Nose', right_ear: 'Ear', right_jaw: 'Jaw/TMJ', right_occipital: 'Occipital', right_neck: 'Neck',
    },

    async init() {
      for (const view of this.views) {
        try {
          const r = await fetch(`svg/head-${view.key}.svg`);
          if (r.ok) this.svgContent[view.key] = await r.text();
        } catch { /* ignore */ }
      }
    },

    onSvgClick(event, viewKey) {
      const el = event.target;
      if (el.classList.contains('head-region') && el.dataset.region) {
        event.stopPropagation();
        this.toggleRegion(viewKey, el.dataset.region);
      }
    },

    handlePanelClick(event, viewKey) {
      // Background click → drop a pin
      if (event.target.classList.contains('head-region')) return;
      const wrapper = event.currentTarget;
      const rect = wrapper.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top)  / rect.height));
      this.incident.painLocations[viewKey].pins.push({ x, y });
    },

    toggleRegion(viewKey, regionId) {
      const regions = this.incident.painLocations[viewKey].regions;
      const idx = regions.indexOf(regionId);
      if (idx >= 0) regions.splice(idx, 1);
      else          regions.push(regionId);
      // Update DOM selected state
      this.$nextTick(() => {
        const wrappers = document.querySelectorAll('.head-diagram__svg-wrapper');
        wrappers.forEach((wrapper, i) => {
          const vk = this.views[i]?.key;
          if (!vk) return;
          const sel = this.incident.painLocations[vk].regions;
          wrapper.querySelectorAll('.head-region').forEach(p => {
            p.classList.toggle('selected', sel.includes(p.dataset.region));
          });
        });
      });
    },

    removePin(viewKey, pinIdx) {
      this.incident.painLocations[viewKey].pins.splice(pinIdx, 1);
    },

    regionLabel(rid) {
      return this.regionLabels[rid] ?? rid.replace(/_/g, ' ');
    },
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  return {
    elapsed: '',
    elapsedTimer: null,

    get manifest() { return Alpine.store('data').manifest; },
    get activeEntry() { return Manifest.activeEntry(); },

    get recentIncidents() {
      return (this.manifest?.incidents ?? []).slice(0, 8);
    },

    get stats() {
      const all = this.manifest?.incidents ?? [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonth  = all.filter(i => new Date(i.startTime) >= monthStart).length;
      const withPain   = all.filter(i => i.peakPainLevel);
      const avgPain    = withPain.length ? withPain.reduce((s,i) => s + i.peakPainLevel, 0) / withPain.length : null;
      const withDur    = all.filter(i => i.durationMinutes);
      const avgMins    = withDur.length  ? withDur.reduce((s,i) => s + i.durationMinutes, 0) / withDur.length : null;
      return { thisMonth, avgPain, avgDuration: avgMins ? Utils.formatDuration(Math.round(avgMins)) : null };
    },

    init() {
      this.updateElapsed();
      this.elapsedTimer = setInterval(() => this.updateElapsed(), 30000);
      document.addEventListener('view-loaded', () => clearInterval(this.elapsedTimer), { once: true });
    },

    updateElapsed() {
      const active = this.activeEntry;
      if (active?.startTime) this.elapsed = Utils.elapsed(active.startTime);
    },

    async endAttack() {
      const active = this.activeEntry;
      if (!active) return;
      try {
        const incident = await Drive.loadIncident(active.id);
        await App.saveIncident(incident, { close: true });
        Notifications.stop();
      } catch {
        Toast.error('Could not end attack. Please try again.');
      }
    },
  };
}

// ── Log Incident (includes HeadDiagram functionality) ────────────────────────

function LogIncident() {
  return {
    incident: null,
    isNew: true,
    isEditing: false,
    _incidentSnapshot: null,
    loading: true,
    saving: false,
    locationLoading: false,
    customTypeInput: '',
    newProdrome: '',
    newSymptom: '',
    newTrigger: '',
    newAffectedActivity: '',
    customProdromeItems: [],
    customSymptomItems: [],
    customTriggerItems: [],

    // ── Head Diagram (merged) ──────────────────────────────────────────
    views: [
      { key: 'front', label: 'Front', imgSrc: 'img/head-front.png', viewBox: '0 0 500 677' },
      { key: 'back',  label: 'Back',  imgSrc: 'img/head-back.png',  viewBox: '0 0 500 637' },
    ],
    svgContent: { front: '', back: '' },
    regionLabels: {
      front_forehead_left:'Left Forehead', front_forehead_right:'Right Forehead',
      front_temple_left:'Left Temple', front_temple_right:'Right Temple',
      front_face_left:'Left Face', front_face_right:'Right Face',
      front_jaw_left:'Left Jaw', front_jaw_right:'Right Jaw',
      front_neck_left:'Left Neck', front_neck_right:'Right Neck',
      back_crown_left:'Left Crown', back_crown_right:'Right Crown',
      back_occipital_left:'Left Occipital', back_occipital_right:'Right Occipital',
      back_neck_left:'Left Neck', back_neck_right:'Right Neck',
    },

    async loadSVGs() {
      for (const view of this.views) {
        try {
          const r = await fetch(`svg/head-${view.key}.svg`);
          if (r.ok) this.svgContent[view.key] = await r.text();
        } catch { /* ignore */ }
      }
    },

    onSvgClick(event, viewKey) {
      if (!this.isEditing) return;
      if (event.target.classList.contains('head-region') && event.target.dataset.region) {
        event.stopPropagation();
        this.toggleRegion(viewKey, event.target.dataset.region);
      }
    },

    _ensurePainLoc(viewKey) {
      if (!this.incident.painLocations[viewKey]) {
        this.incident.painLocations[viewKey] = { regions: [], pins: [] };
      }
      return this.incident.painLocations[viewKey];
    },

    handlePanelClick(event, viewKey) {
      if (!this.isEditing) return;
      if (event.target.classList.contains('head-region')) return;
      const wrapper = event.currentTarget;
      const rect = wrapper.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top)  / rect.height));
      if (this.incident) this._ensurePainLoc(viewKey).pins.push({ x, y });
    },

    toggleRegion(viewKey, regionId) {
      if (!this.incident) return;
      const loc = this._ensurePainLoc(viewKey);
      const regions = loc.regions;
      const idx = regions.indexOf(regionId);
      if (idx >= 0) regions.splice(idx, 1);
      else          regions.push(regionId);
      this.$nextTick(() => {
        document.querySelectorAll('.head-diagram__svg-wrapper').forEach((wrapper, i) => {
          const vk = this.views[i]?.key;
          if (!vk) return;
          const sel = this.incident.painLocations[vk]?.regions ?? [];
          wrapper.querySelectorAll('.head-region').forEach(p => {
            p.classList.toggle('selected', sel.includes(p.dataset.region));
          });
        });
      });
    },

    removePin(viewKey, pinIdx) {
      if (this.incident) this.incident.painLocations[viewKey]?.pins?.splice(pinIdx, 1);
    },

    regionLabel(rid) {
      return this.regionLabels[rid] ?? rid.replace(/_/g, ' ');
    },

    get allTypes() {
      const base   = [...CONFIG.attackTypes];
      const custom = (Alpine.store('data').settings?.customAttackTypes ?? [])
        .map(c => ({ id: 'custom_' + c.toLowerCase().replace(/\s+/g,'_'), label: c }));
      return [...base, ...custom];
    },

    get allAffectedActivities() {
      const base   = [...CONFIG.affectedActivities];
      const custom = (Alpine.store('data').settings?.customAffectedActivities ?? [])
        .map(c => ({ id: 'custom_act_' + c.toLowerCase().replace(/\s+/g,'_'), label: c }));
      return [...base, ...custom];
    },

    async init() {
      const params = Alpine.store('ui').routeParams;
      const id     = params?.id;
      this.isNew   = !id || id === 'new';
      this.isEditing = this.isNew;  // new incidents start in edit mode
      if (this.isNew) {
        this.incident = IncidentFactory.blank();
        this.loading  = false;
      } else {
        try {
          this.incident = await Drive.loadIncident(id);
        } catch {
          Toast.error('Could not load incident.');
          Router.go('dashboard');
          return;
        } finally {
          this.loading = false;
        }
      }
      // Load SVG diagrams in the background
      this.loadSVGs();
    },

    toInput(iso) { return Utils.toInputDateTime(iso); },
    toggle(arr, id) { const i = arr.indexOf(id); i >= 0 ? arr.splice(i,1) : arr.push(id); },

    addCustom(incProp, inputProp, customArray) {
      const label = this[inputProp].trim();
      if (!label) return;
      const id = 'custom_' + label.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
      customArray.push({ id, label });
      this.incident[incProp].push(id);
      this[inputProp] = '';
    },

    addCustomType() {
      const label = this.customTypeInput.trim();
      if (!label) return;
      const settings = Alpine.store('data').settings;
      if (!settings.customAttackTypes.includes(label)) {
        settings.customAttackTypes.push(label);
        Drive.saveSettings(settings);
      }
      this.incident.type = 'custom_' + label.toLowerCase().replace(/\s+/g,'_');
      this.customTypeInput = '';
    },

    addCustomActivity() {
      const label = this.newAffectedActivity.trim();
      if (!label) return;
      const settings = Alpine.store('data').settings;
      if (!settings.customAffectedActivities) settings.customAffectedActivities = [];
      if (!settings.customAffectedActivities.includes(label)) {
        settings.customAffectedActivities.push(label);
        Drive.saveSettings(settings);
      }
      const id = 'custom_act_' + label.toLowerCase().replace(/\s+/g,'_');
      if (!this.incident.affectedActivities.includes(id)) {
        this.incident.affectedActivities.push(id);
      }
      this.newAffectedActivity = '';
    },

    syncRegionClasses() {
      this.$nextTick(() => {
        document.querySelectorAll('.head-diagram__svg-wrapper').forEach((wrapper, i) => {
          const vk = this.views[i]?.key;
          if (!vk || !this.incident) return;
          const sel = this.incident.painLocations[vk]?.regions ?? [];
          wrapper.querySelectorAll('.head-region').forEach(p => {
            p.classList.toggle('selected', sel.includes(p.dataset.region));
          });
        });
      });
    },

    startEdit() {
      this._incidentSnapshot = JSON.parse(JSON.stringify(this.incident));
      this.isEditing = true;
    },

    cancelEdit() {
      if (this._incidentSnapshot) {
        this.incident = JSON.parse(JSON.stringify(this._incidentSnapshot));
        this._incidentSnapshot = null;
        this.syncRegionClasses();
      }
      this.isEditing = false;
    },

    autoSave() { AutoSave.queue(this.incident); },

    async captureLocation() {
      if (!navigator.geolocation) { Toast.info('Geolocation not supported.'); return; }
      this.locationLoading = true;
      navigator.geolocation.getCurrentPosition(
        pos => { this.incident.location = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }; this.locationLoading = false; },
        ()  => { Toast.error('Could not get location.'); this.locationLoading = false; }
      );
    },

    async startAttack() {
      this.saving = true;
      this.incident.isActive = true;
      this.incident.endTime  = null;
      try { await App.saveIncident(this.incident); Notifications.startPrompt(); Router.go('dashboard'); }
      finally { this.saving = false; }
    },

    async saveAndClose() {
      this.saving = true;
      try { await App.saveIncident(this.incident, { close: true }); Router.go('dashboard'); }
      finally { this.saving = false; }
    },

    async saveIncident() {
      this.saving = true;
      try {
        await App.saveIncident(this.incident);
        this._incidentSnapshot = null;
        this.isEditing = false;
        Toast.success('Saved.');
      } finally { this.saving = false; }
    },

    async confirmDelete() {
      if (!confirm('Delete this incident? This cannot be undone.')) return;
      await App.deleteIncident(this.incident.id);
    },

    effectivenessLabel(e) { return { helpful:'Helped', somewhat_helpful:'Somewhat', unhelpful:"Didn't help", unsure:'Unsure' }[e] ?? e; },
    effectivenessColor(e) { return { helpful:'color:var(--success)', somewhat_helpful:'color:var(--warning)', unhelpful:'color:var(--danger)', unsure:'color:var(--info)' }[e] ?? ''; },
  };
}

// ── Check-in ─────────────────────────────────────────────────────────────────

function CheckIn() {
  return {
    incident: null,
    loading: true,
    saving: false,
    customTreatment: '',
    checkIn: { id: '', timestamp: '', painLevel: null, symptoms: [], treatments: [], note: '' },

    async init() {
      const id = Alpine.store('ui').routeParams?.id;
      if (!id) { Router.go('dashboard'); return; }
      this.checkIn.id        = Utils.uuid();
      this.checkIn.timestamp = Utils.nowISO();
      try {
        this.incident = await Drive.loadIncident(id);
        const last = this.incident.checkIns?.at(-1);
        if (last?.symptoms) this.checkIn.symptoms = [...last.symptoms];
      } catch {
        Toast.error('Could not load incident.');
        Router.go('dashboard');
        return;
      } finally {
        this.loading = false;
      }
    },

    toInput(iso) { return Utils.toInputDateTime(iso); },
    toggleSymptom(id) { const i = this.checkIn.symptoms.indexOf(id); i >= 0 ? this.checkIn.symptoms.splice(i,1) : this.checkIn.symptoms.push(id); },
    treatmentAdded(id) { return this.checkIn.treatments.some(t => t.id === id); },
    addTreatment(id, name, type) { if (this.treatmentAdded(id)) return; this.checkIn.treatments.push({ id, name, type, effectiveness: null }); },
    addCustomTreatment() {
      const name = this.customTreatment.trim();
      if (!name) return;
      this.checkIn.treatments.push({ id: 'custom_' + Date.now(), name, type: 'custom', effectiveness: null });
      this.customTreatment = '';
    },
    goBack() { const id = Alpine.store('ui').routeParams?.id; id ? Router.go('log', { id }) : Router.go('dashboard'); },

    async submit() {
      if (!this.checkIn.painLevel) return;
      this.saving = true;
      try {
        this.incident.checkIns = this.incident.checkIns ?? [];
        this.incident.checkIns.push(this.checkIn);
        const levels = this.incident.checkIns.map(c => c.painLevel).filter(Boolean);
        this.incident.peakPainLevel = Math.max(...levels);
        await App.saveIncident(this.incident);
        Toast.success('Check-in saved.');
        Router.go('log', { id: this.incident.id });
      } catch {
        Toast.error('Could not save check-in.');
      } finally {
        this.saving = false;
      }
    },
  };
}

// ── Analytics ────────────────────────────────────────────────────────────────

function Analytics() {
  return {
    tab: 'calendar',
    loading: false,
    allIncidents: null,
    selectedIncidentId: '',
    noCheckIns: false,
    calendarSVG: '',
    triggerDataAvailable: false,
    treatmentStats: [],
    _charts: {},

    get manifest() { return Alpine.store('data').manifest ?? { incidents: [] }; },

    async init() {
      this.$watch('tab', t => this.onTabChange(t));
      this.loading = true;
      this.allIncidents = await App.loadAllForAnalytics();
      this.loading = false;
      this.onTabChange(this.tab);
    },

    async onTabChange(tab) {
      await this.$nextTick();
      ['pain-time','triggers','trends'].forEach(k => this.destroyChart(k));
      if (tab === 'calendar')   this.drawCalendar();
      if (tab === 'triggers')   this.drawTriggers();
      if (tab === 'treatments') this.computeTreatments();
      if (tab === 'trends')     this.drawTrends();
    },

    async drawPainOverTime() {
      await this.$nextTick();
      this.destroyChart('pain-time');
      if (!this.selectedIncidentId) return;
      let incident = this.allIncidents?.find(i => i.id === this.selectedIncidentId);
      if (!incident) { try { incident = await Drive.loadIncident(this.selectedIncidentId); } catch { return; } }
      const checkIns = (incident.checkIns ?? []).filter(c => c.painLevel);
      this.noCheckIns = !checkIns.length;
      if (this.noCheckIns) return;
      const canvas = document.getElementById('chart-pain-time');
      if (canvas) this._charts['pain-time'] = Charts.painOverTime(canvas, incident);
    },

    drawCalendar() {
      if (!this.allIncidents?.length) {
        this.calendarSVG = '<p style="color:var(--text-muted);padding:1rem">No incidents to display yet.</p>';
        return;
      }
      const dayCount = {};
      for (const inc of this.allIncidents) {
        if (!inc.startTime) continue;
        const d = new Date(inc.startTime);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        dayCount[key] = (dayCount[key] ?? 0) + 1;
      }
      const cellSize = 12, gap = 2, pad = 28, weeks = 52;
      const width  = weeks * (cellSize + gap) + pad;
      const height = 7   * (cellSize + gap) + pad + 16;
      const today = new Date();
      const start = new Date(today);
      start.setDate(start.getDate() - (weeks * 7 - 1) - start.getDay());
      const cells = [], months = {};
      const cur = new Date(start);
      for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
          const key  = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
          const cnt  = dayCount[key] ?? 0;
          const lvl  = cnt === 0 ? 0 : cnt === 1 ? 1 : cnt === 2 ? 2 : cnt <= 3 ? 3 : 4;
          const x    = w * (cellSize + gap) + pad;
          const y    = d * (cellSize + gap) + 16;
          const fill = ['var(--bg-elevated)','rgba(124,106,255,.3)','rgba(124,106,255,.55)','rgba(124,106,255,.8)','#7c6aff'][lvl];
          cells.push(`<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fill}"><title>${key}: ${cnt} headache${cnt!==1?'s':''}</title></rect>`);
          if (d === 0 && cur.getDate() <= 7) months[x] = cur.toLocaleDateString('en-US', { month: 'short' });
          cur.setDate(cur.getDate() + 1);
        }
      }
      const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((l,i) => i%2===1 ? `<text x="0" y="${i*(cellSize+gap)+16+cellSize}" font-size="9" fill="#5a5a78">${l}</text>` : '').join('');
      const monthLabels = Object.entries(months).map(([x,l]) => `<text x="${x}" y="10" font-size="9" fill="#5a5a78">${l}</text>`).join('');
      this.calendarSVG = `<svg viewBox="0 0 ${width} ${height}" style="min-width:${width}px">${monthLabels}${dayLabels}${cells.join('')}</svg>`;
    },

    drawTriggers() {
      const hasTriggers = this.allIncidents?.some(i => i.triggers?.length);
      this.triggerDataAvailable = hasTriggers;
      if (!hasTriggers) return;
      const canvas = document.getElementById('chart-triggers');
      if (canvas && this.allIncidents) this._charts['triggers'] = Charts.triggers(canvas, this.allIncidents);
    },

    computeTreatments() {
      const tally = {};
      for (const inc of (this.allIncidents ?? [])) {
        for (const ci of (inc.checkIns ?? [])) {
          for (const t of (ci.treatments ?? [])) {
            if (!t.effectiveness) continue;
            if (!tally[t.id]) tally[t.id] = { name: t.name, helpful: 0, total: 0 };
            tally[t.id].total++;
            if (t.effectiveness === 'helpful' || t.effectiveness === 'somewhat_helpful') tally[t.id].helpful++;
          }
        }
      }
      this.treatmentStats = Object.values(tally)
        .filter(t => t.total >= 1)
        .map(t => ({ ...t, helpfulPct: Math.round((t.helpful/t.total)*100) }))
        .sort((a,b) => b.helpfulPct - a.helpfulPct);
    },

    drawTrends() {
      if (!this.allIncidents || this.allIncidents.length < 2) return;
      const canvas = document.getElementById('chart-trends');
      if (canvas) this._charts['trends'] = Charts.trends(canvas, this.allIncidents);
    },

    destroyChart(key) {
      if (this._charts[key]) { this._charts[key].destroy(); delete this._charts[key]; }
    },
  };
}

// ── Settings ─────────────────────────────────────────────────────────────────

function Settings() {
  return {
    loading: true,
    exporting: false,
    importing: false,
    importProgress: 0,
    importStatus: '',
    importError: '',
    importDone: false,
    importDoneMessage: '',
    newAttackType: '',
    newAffectedActivity: '',
    notifPermission: 'default',

    get settings() { return Alpine.store('data').settings ?? {}; },

    async init() {
      this.loading = false;
      this.notifPermission = Notifications.permission();
      // Ensure new settings fields exist for users with older settings.json
      const settings = Alpine.store('data').settings;
      if (settings && !settings.customAffectedActivities) {
        settings.customAffectedActivities = [];
      }
      const manifest = Alpine.store('data').manifest;
      if (manifest?.incidents?.length > 0) {
        this.importDone = true;
        this.importDoneMessage = `${manifest.incidents.length} incidents already in Drive.`;
      }
    },

    async startImport(event) {
      const file = event.target.files[0];
      if (!file) return;
      this.importError = '';
      let incidents;
      try {
        const text = await file.text();
        incidents = JSON.parse(text);
        if (!Array.isArray(incidents)) throw new Error('Expected a JSON array.');
      } catch (e) {
        this.importError = 'Invalid file: ' + e.message;
        return;
      }
      this.importing = true;
      this.importProgress = 0;
      this.importStatus = `Uploading 0 of ${incidents.length}…`;
      try {
        await Drive.batchWriteIncidents(incidents, (done, total) => {
          this.importProgress = Math.round((done / total) * 100);
          this.importStatus = `Uploading ${done} of ${total}…`;
        });
        const manifestIncidents = incidents.map(inc => ({
          id: inc.id,
          startTime: inc.startTime,
          endTime: inc.endTime ?? null,
          isActive: inc.isActive ?? false,
          type: inc.type ?? 'migraine',
          customTypeName: inc.customTypeName ?? null,
          peakPainLevel: inc.peakPainLevel ?? null,
          durationMinutes: inc.durationMinutes ?? null,
        }));
        manifestIncidents.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        const manifest = { version: 1, updatedAt: new Date().toISOString(), incidents: manifestIncidents };
        await Drive.saveManifest(manifest);
        Alpine.store('data').manifest = manifest;
        Alpine.store('data').allIncidents = null;
        this.importDoneMessage = `${incidents.length} incidents imported successfully.`;
        this.importDone = true;
        Toast.success(`Imported ${incidents.length} incidents.`);
      } catch (e) {
        console.error('Import failed:', e);
        this.importError = 'Upload failed — check your connection and try again.';
        Toast.error('Import failed.');
      } finally {
        this.importing = false;
      }
    },

    async save() {
      try {
        await Drive.saveSettings(this.settings);
        if (this.settings.notifications?.enabled) Notifications.start(this.settings.notifications.intervalMinutes);
        else Notifications.stop();
      } catch { Toast.error('Could not save settings.'); }
    },

    addAttackType() {
      const t = this.newAttackType.trim();
      if (!t || this.settings.customAttackTypes?.includes(t)) return;
      this.settings.customAttackTypes = [...(this.settings.customAttackTypes ?? []), t];
      this.newAttackType = '';
      this.save();
    },

    addAffectedActivity() {
      const t = this.newAffectedActivity.trim();
      if (!t || this.settings.customAffectedActivities?.includes(t)) return;
      this.settings.customAffectedActivities = [...(this.settings.customAffectedActivities ?? []), t];
      this.newAffectedActivity = '';
      this.save();
    },

    async requestNotifPermission() {
      const granted = await Notifications.requestPermission();
      this.notifPermission = Notifications.permission();
      if (granted) { Toast.success('Notifications enabled.'); this.settings.notifications.enabled = true; this.save(); }
      else Toast.info('Notification permission denied. Check browser settings.');
    },

    async exportCSV() {
      this.exporting = true;
      try { const incidents = await App.loadAllForAnalytics(); ExportCSV.download(incidents); Toast.success('CSV downloaded.'); }
      catch { Toast.error('Export failed.'); }
      finally { this.exporting = false; }
    },

    async exportJSON() {
      this.exporting = true;
      try {
        const incidents = await App.loadAllForAnalytics();
        const blob = new Blob([JSON.stringify({ incidents, settings: this.settings }, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: `headache-backup-${new Date().toISOString().slice(0,10)}.json` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Toast.success('JSON downloaded.');
      } catch { Toast.error('Export failed.'); }
      finally { this.exporting = false; }
    },

    signOut() {
      if (!confirm('Sign out? Your data remains safely in your Google Drive.')) return;
      Auth.signOut();
    },
  };
}
