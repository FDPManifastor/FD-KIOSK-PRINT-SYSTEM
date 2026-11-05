// Live tijd en bedrag + Aan / Pauze / Uit onder elke stationkaart op de
// startpagina (index.html). Stations zonder timer tonen dat de timer nog
// niet is ingeschakeld.
(function () {
  const keyStorage = 'fdp-backoffice-key';
  const pollMs = 3000;
  const panels = new Map(); // folder -> { el, layout }
  let stations = new Map(); // folder -> status object from server
  let clockOffset = 0;
  let loadError = '';

  const style = document.createElement('style');
  style.textContent = [
    '.st-wrap{display:flex;flex-direction:column;gap:.5rem}',
    '.st-wrap>.copy-card{display:block}',
    '.st-panel{border-radius:.9rem;background:#fff;border:2px solid #e5e7eb;padding:.75rem .9rem;font-variant-numeric:tabular-nums;',
    'box-shadow:0 2px 8px rgba(0,0,0,.05);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.st-panel--active{border-color:#16a34a;background:#f0fdf4}',
    '.st-panel--paused{border-color:#f59e0b;background:#fffbeb}',
    '.st-panel--stopped{border-color:#dc2626;background:#fef2f2}',
    '.st-panel--disabled{background:#f9fafb;color:#9ca3af;font-size:.8rem;text-align:center;padding:.55rem}',
    '.st-head{display:flex;align-items:center;justify-content:space-between;gap:.5rem;font-size:.72rem;font-weight:800;',
    'text-transform:uppercase;letter-spacing:.08em;color:#6b7280}',
    '.st-badge{border-radius:999px;padding:.12rem .55rem;color:#fff;background:#9ca3af}',
    '.st-panel--active .st-badge{background:#16a34a}',
    '.st-panel--paused .st-badge{background:#f59e0b}',
    '.st-panel--stopped .st-badge{background:#dc2626}',
    '.st-nums{display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;margin:.35rem 0 .1rem}',
    '.st-time{font-size:1.7rem;font-weight:900;color:#111827;line-height:1}',
    '.st-cost{font-size:1.5rem;font-weight:900;color:#b91c1c;line-height:1}',
    '.st-sub{font-size:.72rem;color:#6b7280;margin:0 0 .55rem}',
    '.st-actions{display:flex;gap:.4rem}',
    '.st-btn{flex:1;border:0;border-radius:.6rem;padding:.55rem .4rem;font-weight:800;font-size:.85rem;color:#fff;cursor:pointer}',
    '.st-btn:disabled{opacity:.55;cursor:wait}',
    '.st-on{background:#16a34a}.st-on:hover{background:#15803d}',
    '.st-pause{background:#f59e0b}.st-pause:hover{background:#d97706}',
    '.st-off{background:#dc2626}.st-off:hover{background:#b91c1c}',
    '.st-clear{background:#374151}.st-clear:hover{background:#1f2937}',
    '.st-dot{display:inline-block;width:.45rem;height:.45rem;border-radius:50%;background:#fff;margin-right:.3rem;vertical-align:middle;',
    'animation:stPulse 1.4s ease-in-out infinite}',
    '@keyframes stPulse{0%,100%{opacity:1}50%{opacity:.25}}',
    '.st-error{margin:0 0 1rem;border-radius:.6rem;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;font-weight:600;font-size:.85rem;padding:.6rem .8rem}'
  ].join('');
  document.head.appendChild(style);

  function getKey() {
    try { return sessionStorage.getItem(keyStorage) || ''; } catch (error) { return ''; }
  }

  function setKey(value) {
    try { sessionStorage.setItem(keyStorage, value); } catch (error) { /* ignore */ }
  }

  function euro(cents) {
    return '€' + (cents / 100).toFixed(2).replace('.', ',');
  }

  function costCents(elapsedMs, p) {
    const baseMs = p.baseMinutes * 60000;
    const stepMs = p.stepMinutes * 60000;
    const extra = elapsedMs > baseMs ? Math.ceil((elapsedMs - baseMs) / stepMs) : 0;
    return p.baseCents + extra * p.stepCents;
  }

  function duration(ms) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return (h > 0 ? h + ':' : '') + m + ':' + s;
  }

  function clock(timestamp) {
    return new Date(timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function liveElapsed(station) {
    const base = station.elapsedMs || 0;
    if (station.status !== 'active') return base;
    return base + Math.max(0, Date.now() + clockOffset - station.serverNow);
  }

  // Wrap every station card so a status panel can sit underneath it.
  document.querySelectorAll('a.copy-card[href]').forEach(function (card) {
    const match = card.getAttribute('href').match(/files_([a-z0-9_]+)\.html/i);
    if (!match) return;
    const folder = match[1];
    const wrap = document.createElement('div');
    wrap.className = 'st-wrap';
    card.parentNode.insertBefore(wrap, card);
    wrap.appendChild(card);
    const panel = document.createElement('div');
    panel.className = 'st-panel st-panel--disabled';
    panel.textContent = 'Timer laden...';
    wrap.appendChild(panel);
    panels.set(folder, { el: panel, layout: '' });
  });

  if (!panels.size) return;

  const errorBox = document.createElement('p');
  errorBox.className = 'st-error';
  errorBox.hidden = true;
  const main = document.querySelector('main .max-w-6xl') || document.body;
  main.insertBefore(errorBox, main.firstChild);

  function button(action, folder, cls, label) {
    return '<button type="button" class="st-btn ' + cls + '" data-st-action="' + action + '" data-st-folder="' + folder + '">' + label + '</button>';
  }

  function layoutFor(folder, station) {
    if (!station) {
      return { cls: 'st-panel st-panel--disabled', html: 'Timer nog niet ingeschakeld' };
    }

    const label = { idle: 'Uit', active: 'Aan', paused: 'Pauze', stopped: 'Afrekenen' }[station.status] || station.status;
    const head = '<div class="st-head"><span>Tijd · excl. printen</span><span class="st-badge">'
      + (station.status === 'active' ? '<span class="st-dot"></span>' : '') + label + '</span></div>';

    if (station.status === 'idle') {
      return {
        cls: 'st-panel',
        html: head + '<p class="st-sub" style="margin:.4rem 0 .55rem">Computer is niet vrijgegeven.</p>'
          + '<div class="st-actions">' + button('start', folder, 'st-on', 'Aan') + '</div>'
      };
    }

    const nums = '<div class="st-nums"><span class="st-time" data-st-time></span><span class="st-cost" data-st-cost></span></div>';

    if (station.status === 'stopped') {
      return {
        cls: 'st-panel st-panel--stopped',
        html: head + nums + '<p class="st-sub">' + clock(station.startedAt) + ' - ' + clock(station.stoppedAt) + ' · te betalen' + (station.stoppedBy === 'customer' ? ' · klant heeft afgerond' : '') + '</p><p class="st-sub" style="margin-top:-.4rem">Alleen tijd · excl. printen</p>'
          + '<div class="st-actions">' + button('start', folder, 'st-on', 'Aan') + button('reset', folder, 'st-clear', 'Betaald') + '</div>'
      };
    }

    if (station.status === 'paused') {
      return {
        cls: 'st-panel st-panel--paused',
        html: head + nums + '<p class="st-sub">Open sinds ' + clock(station.startedAt) + ' · gepauzeerd om ' + clock(station.pausedAt) + '</p>'
          + '<div class="st-actions">' + button('resume', folder, 'st-on', 'Hervat') + button('stop', folder, 'st-off', 'Uit') + '</div>'
      };
    }

    return {
      cls: 'st-panel st-panel--active',
      html: head + nums + '<p class="st-sub">Open sinds ' + clock(station.startedAt) + '</p>'
        + '<div class="st-actions">' + button('pause', folder, 'st-pause', 'Pauze') + button('stop', folder, 'st-off', 'Uit') + '</div>'
    };
  }

  function render() {
    errorBox.textContent = loadError;
    errorBox.hidden = !loadError;

    panels.forEach(function (panel, folder) {
      const station = stations.get(folder);
      const layoutKey = station ? station.status + '-' + station.startedAt + '-' + (station.pausedAt || '') : 'disabled';
      if (panel.layout !== layoutKey) {
        const layout = layoutFor(folder, station);
        panel.el.className = layout.cls;
        panel.el.innerHTML = layout.html;
        panel.layout = layoutKey;
      }
      tickPanel(panel, station);
    });
  }

  function tickPanel(panel, station) {
    if (!station || station.status === 'idle') return;
    const elapsed = liveElapsed(station);
    const timeEl = panel.el.querySelector('[data-st-time]');
    const costEl = panel.el.querySelector('[data-st-cost]');
    if (timeEl) timeEl.textContent = duration(elapsed);
    if (costEl) costEl.textContent = euro(station.status === 'stopped' ? station.costCents : costCents(elapsed, station.pricing));
  }

  // De sleutel komt uit de link van de locatie of de beheerlink (window.FDPAccess).
  function accessKey() {
    return (window.FDPAccess && window.FDPAccess.key) || getKey();
  }

  async function api(path, method) {
    const response = await fetch(path, { method: method || 'GET', cache: 'no-store', headers: { 'x-access-key': accessKey() } });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || ('Status ' + response.status));
    return data;
  }

  async function refresh() {
    try {
      const data = await api('/backoffice/api/stations');
      clockOffset = data.serverNow - Date.now();
      stations = new Map((data.stations || []).map(function (s) { return [s.folder, s]; }));
      loadError = '';
    } catch (error) {
      loadError = 'Timers konden niet geladen worden: ' + error.message;
    }
    render();
  }

  async function act(action, folder) {
    if (action === 'stop' && !window.confirm('Sessie stoppen? Het bedrag staat dan vast om af te rekenen.')) return;
    try {
      await api('/backoffice/api/stations/' + encodeURIComponent(folder) + '/' + action, 'POST');
      loadError = '';
    } catch (error) {
      loadError = error.message;
    }
    await refresh();
  }

  document.addEventListener('click', function (event) {
    const btn = event.target.closest('button[data-st-action]');
    if (!btn) return;
    event.preventDefault();
    btn.disabled = true;
    act(btn.getAttribute('data-st-action'), btn.getAttribute('data-st-folder'));
  });

  refresh();
  setInterval(refresh, pollMs);
  setInterval(function () {
    panels.forEach(function (panel, folder) { tickPanel(panel, stations.get(folder)); });
  }, 1000);
})();
