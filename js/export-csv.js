/**
 * export-csv.js — Doctor-readable CSV export
 *
 * Generates a CSV entirely in the browser and triggers a download.
 * One row per incident. Multi-value fields joined with " | ".
 * Check-ins are summarized (not expanded to separate rows).
 */

const ExportCSV = {

  /** Convert a list of IDs to human labels using CONFIG */
  _labels(configKey, ids) {
    if (!ids?.length) return '';
    const list = CONFIG[configKey] ?? [];
    return ids.map(id => list.find(x => x.id === id)?.label ?? id).join(' | ');
  },

  /** Summarize treatments for the CSV */
  _treatmentSummary(checkIns) {
    const all = {};
    for (const ci of (checkIns ?? [])) {
      for (const t of (ci.treatments ?? [])) {
        if (!all[t.id]) all[t.id] = { name: t.name, ratings: [] };
        if (t.effectiveness) all[t.id].ratings.push(t.effectiveness);
      }
    }
    return Object.values(all)
      .map(({ name, ratings }) => {
        if (!ratings.length) return name;
        const rating = ratings[ratings.length - 1]; // most recent rating
        const label = { helpful:'(helped)', somewhat_helpful:'(somewhat)', unhelpful:'(no help)', unsure:'(unsure)' }[rating] ?? '';
        return `${name} ${label}`.trim();
      })
      .join(' | ');
  },

  /** Find the most helpful treatment across all check-ins */
  _mostHelpful(checkIns) {
    const helpers = [];
    for (const ci of (checkIns ?? [])) {
      for (const t of (ci.treatments ?? [])) {
        if (t.effectiveness === 'helpful') helpers.push(t.name);
      }
    }
    return [...new Set(helpers)].join(' | ');
  },

  /** Escape a value for CSV */
  _cell(value) {
    if (value == null) return '';
    const s = String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  },

  /** Build a CSV row array and stringify */
  _row(cells) {
    return cells.map(ExportCSV._cell).join(',');
  },

  /**
   * Generate and download a CSV for all incidents.
   * @param {Array} incidents  — full incident objects
   */
  download(incidents) {
    const HEADERS = [
      'Date',
      'Start Time',
      'End Time',
      'Duration',
      'Type',
      'Peak Pain (1–10)',
      'Pain Locations',
      'Warning Signs (Before Attack)',
      'Symptoms',
      'Triggers',
      'Affected Activities',
      'Treatments (with Effectiveness)',
      'Most Helpful Treatment',
      'Notes',
      'Check-in Count',
    ];

    const rows = [ExportCSV._row(HEADERS)];

    const sorted = [...incidents].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    for (const inc of sorted) {
      // Pain location: combine all views into a flat list of region labels
      const allRegions = [];
      for (const view of ['front','back','left','right']) {
        const regions = inc.painLocations?.[view]?.regions ?? [];
        const labels = regions.map(r => {
          const nice = r.replace(/^(front|back|left|right)_/, '').replace(/_/g, ' ');
          return nice.charAt(0).toUpperCase() + nice.slice(1) + ` (${view})`;
        });
        allRegions.push(...labels);
      }
      const pinCount = ['front','back','left','right'].reduce((n, v) =>
        n + (inc.painLocations?.[v]?.pins?.length ?? 0), 0);
      if (pinCount > 0) allRegions.push(`${pinCount} precise pin${pinCount!==1?'s':''}`);

      const type = CONFIG.attackTypes.find(t => t.id === inc.type)?.label ?? inc.type ?? '';

      rows.push(ExportCSV._row([
        inc.startTime ? new Date(inc.startTime).toLocaleDateString('en-US') : '',
        inc.startTime ? new Date(inc.startTime).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '',
        inc.endTime   ? new Date(inc.endTime).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '',
        inc.durationMinutes ? Utils.formatDuration(inc.durationMinutes) : (inc.isActive ? 'Ongoing' : ''),
        type,
        inc.peakPainLevel ?? '',
        allRegions.join(' | '),
        ExportCSV._labels('premonitorySymptoms', inc.premonitorySymptoms),
        ExportCSV._labels('symptoms',            inc.symptoms),
        ExportCSV._labels('triggers',            inc.triggers),
        ExportCSV._labels('affectedActivities',  inc.affectedActivities),
        ExportCSV._treatmentSummary(inc.checkIns),
        ExportCSV._mostHelpful(inc.checkIns),
        inc.notes ?? '',
        (inc.checkIns?.length ?? 0).toString(),
      ]));
    }

    const csv  = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `headache-log-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
