/**
 * charts.js — Chart.js factory functions
 *
 * All charts use a dark theme consistent with the app's CSS variables.
 * Each factory function takes a canvas element and data, creates the chart,
 * and returns the Chart instance so the caller can destroy it on teardown.
 */

const Charts = (() => {

  // ── Shared defaults ────────────────────────────────────────────────────────

  Chart.defaults.color           = '#9090b0';
  Chart.defaults.borderColor     = '#2a2a42';
  Chart.defaults.font.family     = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  Chart.defaults.font.size       = 12;

  const gridColor   = 'rgba(42,42,66,0.8)';
  const accentColor = '#7c6aff';

  function painColor(level) {
    const map = {
      1:'#22c55e',2:'#4ade80',3:'#86efac',4:'#fde047',5:'#facc15',
      6:'#fb923c',7:'#f97316',8:'#ef4444',9:'#dc2626',10:'#991b1b'
    };
    return map[level] ?? accentColor;
  }

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a2e',
        borderColor: '#2a2a42',
        borderWidth: 1,
        titleColor: '#e8e8f0',
        bodyColor: '#9090b0',
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: '#5a5a78' },
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: '#5a5a78' },
      },
    },
  };

  // ── Factory functions ──────────────────────────────────────────────────────

  return {

    /**
     * Pain over time for a single incident (line chart of check-in pain levels).
     * @param {HTMLCanvasElement} canvas
     * @param {Object} incident
     */
    painOverTime(canvas, incident) {
      const checkIns = (incident.checkIns ?? [])
        .filter(c => c.painLevel)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      if (!checkIns.length) return null;

      const labels = checkIns.map(c =>
        Utils.formatDate(c.timestamp) + '\n' + Utils.formatTime(c.timestamp)
      );
      const data   = checkIns.map(c => c.painLevel);
      const colors = data.map(painColor);

      return new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Pain Level',
            data,
            borderColor: accentColor,
            backgroundColor: 'rgba(124,106,255,0.08)',
            tension: 0.3,
            fill: true,
            pointBackgroundColor: colors,
            pointBorderColor: '#fff',
            pointRadius: 6,
            pointHoverRadius: 8,
          }],
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: {
              ...baseOptions.scales.y,
              min: 0, max: 10,
              ticks: { color: '#5a5a78', stepSize: 1 },
            },
          },
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              ...baseOptions.plugins.tooltip,
              callbacks: {
                label: ctx => `Pain: ${ctx.parsed.y}`,
                afterLabel: ctx => {
                  const ci = checkIns[ctx.dataIndex];
                  const txts = [];
                  if (ci.treatments?.length) {
                    txts.push('Treatments: ' + ci.treatments.map(t => t.name).join(', '));
                  }
                  if (ci.note) txts.push(ci.note);
                  return txts;
                },
              },
            },
          },
        },
      });
    },

    /**
     * Trends: avg pain and avg duration per month (dual-axis line chart).
     * @param {HTMLCanvasElement} canvas
     * @param {Array} incidents  — full incident objects
     */
    trends(canvas, incidents) {
      // Group by month
      const byMonth = {};
      for (const inc of incidents) {
        if (!inc.startTime) continue;
        const d  = new Date(inc.startTime);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!byMonth[key]) byMonth[key] = { pains: [], durations: [] };
        if (inc.peakPainLevel)  byMonth[key].pains.push(inc.peakPainLevel);
        if (inc.durationMinutes) byMonth[key].durations.push(inc.durationMinutes);
      }

      const keys    = Object.keys(byMonth).sort();
      const labels  = keys.map(k => { const [y,m] = k.split('-'); return new Date(+y,+m-1,1).toLocaleDateString('en-US',{month:'short',year:'2-digit'}); });
      const avgPain = keys.map(k => {
        const p = byMonth[k].pains;
        return p.length ? (p.reduce((s,v)=>s+v,0)/p.length) : null;
      });
      const avgDur  = keys.map(k => {
        const d = byMonth[k].durations;
        return d.length ? (d.reduce((s,v)=>s+v,0)/d.length/60) : null; // hours
      });

      return new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Avg Pain',
              data: avgPain,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.08)',
              tension: 0.3,
              fill: true,
              yAxisID: 'y',
              pointRadius: 4,
            },
            {
              label: 'Avg Duration (h)',
              data: avgDur,
              borderColor: accentColor,
              backgroundColor: 'rgba(124,106,255,0.08)',
              tension: 0.3,
              fill: true,
              yAxisID: 'y2',
              pointRadius: 4,
            },
          ],
        },
        options: {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            legend: { display: true, labels: { color: '#9090b0', boxWidth: 12 } },
            tooltip: {
              ...baseOptions.plugins.tooltip,
              callbacks: {
                label: ctx => ctx.datasetIndex === 0
                  ? `Avg Pain: ${ctx.parsed.y?.toFixed(1)}`
                  : `Avg Duration: ${ctx.parsed.y?.toFixed(1)}h`,
              },
            },
          },
          scales: {
            x:  { ...baseOptions.scales.x },
            y:  { ...baseOptions.scales.y, min: 0, max: 10, position: 'left',  title: { display: true, text: 'Pain', color: '#9090b0' } },
            y2: { ...baseOptions.scales.y, min: 0, position: 'right', title: { display: true, text: 'Hours', color: '#9090b0' }, grid: { drawOnChartArea: false } },
          },
        },
      });
    },

    /**
     * Trigger frequency + avg pain (horizontal bar chart).
     * @param {HTMLCanvasElement} canvas
     * @param {Array} incidents
     */
    triggers(canvas, incidents) {
      const freq = {};
      const pain = {};

      for (const inc of incidents) {
        for (const trig of (inc.triggers ?? [])) {
          freq[trig] = (freq[trig] ?? 0) + 1;
          if (!pain[trig]) pain[trig] = [];
          if (inc.peakPainLevel) pain[trig].push(inc.peakPainLevel);
        }
      }

      const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);

      const allTriggers = CONFIG.triggers ?? [];
      const labels = sorted.map(([id]) => allTriggers.find(t=>t.id===id)?.label ?? id);
      const counts = sorted.map(([,c]) => c);

      return new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Occurrences',
            data: counts,
            backgroundColor: 'rgba(124,106,255,0.6)',
            borderColor: accentColor,
            borderWidth: 1,
            borderRadius: 4,
          }],
        },
        options: {
          ...baseOptions,
          indexAxis: 'y',
          scales: {
            x: { ...baseOptions.scales.x, beginAtZero: true, ticks: { ...baseOptions.scales.x.ticks, stepSize: 1 } },
            y: { ...baseOptions.scales.y },
          },
        },
      });
    },

    // Calendar heatmap is rendered as SVG (see analytics.html — no Chart.js needed)
  };
})();
