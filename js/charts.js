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

  // Register crosshair plugin globally so it works on all charts
  Chart.register({
    id: 'verticalCrosshair',
    afterDraw(chart) {
      if (chart._crosshairX == null) return;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chart._crosshairX, chartArea.top);
      ctx.lineTo(chart._crosshairX, chartArea.bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(144,144,176,0.5)';
      ctx.stroke();
      ctx.restore();
    },
  });

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
     * Trends: per-incident pain and duration (dual-axis line chart).
     * Crosshair on hover, click to navigate to incident.
     * @param {HTMLCanvasElement} canvas
     * @param {Array} incidents  — full incident objects
     */
    trends(canvas, incidents) {
      const sorted = [...incidents]
        .filter(i => i.startTime)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      const labels = sorted.map(i => {
        const d = new Date(i.startTime);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
      });
      const painData = sorted.map(i => i.peakPainLevel ?? null);
      const durData  = sorted.map(i => i.durationMinutes ? i.durationMinutes / 60 : null);

      const chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Pain',
              data: painData,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.08)',
              pointBackgroundColor: '#ef4444',
              tension: 0.3,
              fill: true,
              yAxisID: 'y',
              pointRadius: 4,
              pointHoverRadius: 7,
              pointBorderColor: '#fff',
              pointBorderWidth: 1,
            },
            {
              label: 'Duration (h)',
              data: durData,
              borderColor: accentColor,
              backgroundColor: 'rgba(124,106,255,0.08)',
              pointBackgroundColor: accentColor,
              tension: 0.3,
              fill: true,
              yAxisID: 'y2',
              pointRadius: 4,
              pointHoverRadius: 7,
              pointBorderColor: '#fff',
              pointBorderWidth: 1,
            },
          ],
        },
        options: {
          ...baseOptions,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          onHover(event, elements, chart) {
            if (!event?.native) return;
            chart._crosshairX = elements.length ? elements[0].element.x : null;
            canvas.style.cursor = elements.length ? 'pointer' : 'default';
            chart.draw();
          },
          onClick(event, elements) {
            if (!event?.native || !elements.length) return;
            // Only navigate on real user clicks (not synthetic events)
            if (event.native.type !== 'click') return;
            const idx = elements[0].index;
            const inc = sorted[idx];
            if (inc?.id) Router.go('log', { id: inc.id });
          },
          plugins: {
            ...baseOptions.plugins,
            legend: { display: true, labels: { color: '#9090b0', usePointStyle: true, pointStyle: 'circle', boxWidth: 8 } },
            tooltip: {
              ...baseOptions.plugins.tooltip,
              mode: 'index',
              intersect: false,
              usePointStyle: true,
              callbacks: {
                title: ctx => {
                  const idx = ctx[0]?.dataIndex;
                  if (idx == null) return '';
                  const inc = sorted[idx];
                  const d = new Date(inc.startTime);
                  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                },
                label: ctx => {
                  if (ctx.datasetIndex === 0) return `Pain: ${ctx.parsed.y ?? '—'}`;
                  return `Duration: ${ctx.parsed.y?.toFixed(1) ?? '—'}h`;
                },
                afterBody: ctx => {
                  const idx = ctx[0]?.dataIndex;
                  if (idx == null) return '';
                  const inc = sorted[idx];
                  const type = CONFIG.attackTypes.find(t => t.id === inc.type)?.label ?? inc.type ?? '';
                  return type ? `Type: ${type}` : '';
                },
                footer: () => 'Click to view incident',
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

      // Clear crosshair on mouse leave
      canvas.addEventListener('mouseleave', () => {
        chart._crosshairX = null;
        chart.draw();
      });

      return chart;
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
