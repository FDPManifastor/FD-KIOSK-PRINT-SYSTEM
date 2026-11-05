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
    '.st-panel--idle{border-color:#ea580c;background:#fff7ed;animation:stIdle 1.6s ease-in-out infinite}',
    '.st-panel--idle .st-badge{background:#ea580c}',
    '.st-alert{margin:.1rem 0 .55rem;font-size:.8rem;font-weight:800;color:#9a3412}',
    '@keyframes stIdle{0%,100%{box-shadow:0 0 0 0 rgba(234,88,12,.45)}50%{box-shadow:0 0 0 8px rgba(234,88,12,0)}}',
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
    '.st-free{background:#1d4ed8}.st-free:hover{background:#1e40af}',
    '.st-panel--free{border-color:#1d4ed8;background:#eff6ff}',
    '.st-panel--done{border-color:#16a34a;background:#f0fdf4;animation:stDone 1.4s ease-in-out infinite}',
    '.st-panel--done .st-badge{background:#16a34a}',
    '.st-done{display:flex;align-items:center;gap:.5rem;margin:.35rem 0 .5rem;padding:.5rem .65rem;border-radius:.6rem;background:#16a34a;color:#fff;font-weight:900;font-size:.95rem}',
    '.st-done small{display:block;font-weight:700;font-size:.72rem;opacity:.9}',
    '@keyframes stDone{0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.5)}50%{box-shadow:0 0 0 10px rgba(22,163,74,0)}}',
    '.st-toast{position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;max-width:calc(100vw - 2rem)}',
    '.st-toast__item{display:flex;align-items:center;gap:.7rem;border:0;text-align:left;cursor:pointer;border-radius:1rem;padding:.8rem 1rem;background:#16a34a;color:#fff;',
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.25);animation:stToastIn .4s cubic-bezier(.2,.9,.3,1.2)}',
    '.st-toast__item strong{display:block;font-size:1.05rem;font-weight:900}',
    '.st-toast__item span{display:block;font-size:.8rem;font-weight:600;opacity:.92}',
    '.st-toast__icon{font-size:1.6rem;animation:stWave 1.2s ease-in-out infinite;transform-origin:70% 80%}',
    '@keyframes stToastIn{from{opacity:0;transform:translateY(-12px) scale(.95)}to{opacity:1;transform:none}}',
    '@keyframes stWave{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}',
    '.tab-btn[data-done-count]::after{content:attr(data-done-count);display:inline-block;margin-left:.4rem;min-width:1.3rem;padding:0 .35rem;border-radius:999px;background:#16a34a;color:#fff;font-size:.8rem;font-weight:900;line-height:1.3rem;text-align:center}',
    '.st-panel--free .st-badge{background:#1d4ed8}',
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

  // Klant drukte zelf op "Ik ben klaar" en is nog niet afgerekend.
  function customerDone(station) {
    return !!(station && station.finishAlert && station.status === 'stopped' && station.stoppedBy === 'customer');
  }

  function ago(timestamp) {
    const min = Math.floor(Math.max(0, Date.now() + clockOffset - timestamp) / 60000);
    return min < 1 ? 'zojuist' : min + ' min geleden';
  }

  function layoutFor(folder, station) {
    if (!station) {
      return { cls: 'st-panel st-panel--disabled', html: 'Timer nog niet ingeschakeld' };
    }

    const free = !!station.free;
    let label = { idle: 'Uit', active: 'Aan', paused: 'Pauze', stopped: 'Afrekenen' }[station.status] || station.status;
    if (free && station.status === 'active') label = 'Vrij';
    if (free && station.status === 'stopped') label = 'Klaar';
    // Knop voor een vrije sessie (geen tijdslimiet, geen kosten), alleen waar de server dat toestaat.
    const freeBtn = station.freeSessionAllowed ? button('start-free', folder, 'st-free', 'Vrije sessie') : '';
    const head = '<div class="st-head"><span>Tijd · excl. printen</span><span class="st-badge">'
      + (station.status === 'active' ? '<span class="st-dot"></span>' : '') + label + '</span></div>';

    if (station.status === 'idle') {
      return {
        cls: 'st-panel',
        html: head + '<p class="st-sub" style="margin:.4rem 0 .55rem">Computer is niet vrijgegeven.</p>'
          + '<div class="st-actions">' + button('start', folder, 'st-on', 'Aan') + freeBtn + '</div>'
      };
    }

    const nums = '<div class="st-nums"><span class="st-time" data-st-time></span><span class="st-cost" data-st-cost></span></div>';

    if (station.status === 'stopped') {
      const done = customerDone(station);
      return {
        cls: 'st-panel st-panel--stopped' + (done ? ' st-panel--done' : ''),
        html: head.replace('>Afrekenen<', done ? '>Klant klaar<' : '>Afrekenen<')
          + (done ? '<div class="st-done"><span>✋</span><div>Klant is klaar' + (free ? '' : ' · afrekenen') + '<small data-st-ago></small></div></div>' : '')
          + nums + '<p class="st-sub">' + clock(station.startedAt) + ' - ' + clock(station.stoppedAt) + (free ? ' · vrije sessie' : ' · te betalen') + (station.stoppedBy === 'customer' ? ' · klant heeft afgerond' : '') + '</p>'
          + (free ? '' : '<p class="st-sub" style="margin-top:-.4rem">Alleen tijd · excl. printen</p>')
          + '<div class="st-actions">' + button('start', folder, 'st-on', 'Aan') + freeBtn + button('reset', folder, 'st-clear', free ? 'Vrijmaken' : 'Betaald') + '</div>'
      };
    }

    if (station.status === 'paused') {
      const idle = station.pausedBy === 'idle';
      return {
        cls: 'st-panel st-panel--paused' + (idle ? ' st-panel--idle' : ''),
        html: head.replace('>Pauze<', idle ? '>Inactief<' : '>Pauze<') + nums
          + (idle ? '<p class="st-alert">Klant reageerde niet op "Ben je nog bezig?" · tijd staat stil. Even gaan kijken.</p>' : '')
          + '<p class="st-sub">Open sinds ' + clock(station.startedAt) + ' · gepauzeerd om ' + clock(station.pausedAt) + '</p>'
          + '<div class="st-actions">' + button('resume', folder, 'st-on', 'Hervat') + button('stop', folder, 'st-off', 'Uit') + '</div>'
      };
    }

    return {
      cls: 'st-panel st-panel--active' + (free ? ' st-panel--free' : ''),
      html: head + nums + '<p class="st-sub">' + (free ? 'Vrije sessie · ' : '') + 'Open sinds ' + clock(station.startedAt) + '</p>'
        + '<div class="st-actions">' + button('pause', folder, 'st-pause', 'Pauze') + button('stop', folder, 'st-off', 'Uit') + '</div>'
    };
  }

  function render() {
    errorBox.textContent = loadError;
    errorBox.hidden = !loadError;

    panels.forEach(function (panel, folder) {
      const station = stations.get(folder);
      const layoutKey = station ? station.status + '-' + station.startedAt + '-' + (station.pausedAt || '') + (station.pausedBy || '') + (station.stoppedBy || '') + (station.free ? '-free' : '') : 'disabled';
      if (panel.layout !== layoutKey) {
        const layout = layoutFor(folder, station);
        panel.el.className = layout.cls;
        panel.el.innerHTML = layout.html;
        panel.layout = layoutKey;
      }
      tickPanel(panel, station);
    });
    renderDoneAlerts();
  }

  // Melding rechtsboven + teller op het tabblad + knipperende titel + geluidje
  // zolang er een klant klaar is die nog niet is afgerekend.
  const toast = document.createElement('div');
  toast.className = 'st-toast';
  document.body.appendChild(toast);
  const baseTitle = document.title;
  let known = null; // folders die al klaar waren (geen geluid bij laden)
  let titleFlip = false;
  let audioCtx = null;

  function ding() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach(function (offset, i) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = i ? 1320 : 880;
        gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + offset + 0.35);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + offset);
        osc.stop(audioCtx.currentTime + offset + 0.4);
      });
    } catch (error) { /* geen geluid mogelijk */ }
  }
  // Browsers spelen pas geluid af na een eerste klik op de pagina.
  document.addEventListener('pointerdown', function () {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (error) { /* negeer */ }
  }, { once: true });

  function tabOf(folder) {
    const panel = panels.get(folder);
    const tab = panel && panel.el.closest('.tab-content');
    return tab ? tab.id : '';
  }

  function renderDoneAlerts() {
    const done = [];
    stations.forEach(function (station, folder) { if (panels.has(folder) && customerDone(station)) done.push(station); });
    const folders = done.map(function (s) { return s.folder; });
    if (known === null) known = folders.slice();
    if (folders.some(function (f) { return known.indexOf(f) === -1; })) ding();
    known = folders.slice();

    toast.innerHTML = done.map(function (s) {
      return '<button type="button" class="st-toast__item" data-st-goto="' + s.folder + '"><span class="st-toast__icon">✋</span><div><strong>' + s.label + ': klant is klaar</strong>'
        + '<span>' + (s.free ? 'Vrije sessie' : 'Afrekenen ' + euro(s.costCents)) + ' · ' + ago(s.stoppedAt) + '</span></div></button>';
    }).join('');

    document.querySelectorAll('.tab-btn[data-tab]').forEach(function (btn) {
      const count = done.filter(function (s) { return tabOf(s.folder) === btn.getAttribute('data-tab'); }).length;
      if (count) btn.setAttribute('data-done-count', count); else btn.removeAttribute('data-done-count');
    });
    if (!done.length) document.title = baseTitle;
  }

  setInterval(function () {
    if (!toast.children.length) return;
    titleFlip = !titleFlip;
    document.title = titleFlip ? '✋ Klant klaar (' + toast.children.length + ')' : baseTitle;
  }, 1200);

  toast.addEventListener('click', function (event) {
    const item = event.target.closest('[data-st-goto]');
    if (!item) return;
    const folder = item.getAttribute('data-st-goto');
    const tabBtn = document.querySelector('.tab-btn[data-tab="' + tabOf(folder) + '"]');
    if (tabBtn) tabBtn.click();
    const panel = panels.get(folder);
    if (panel) setTimeout(function () { panel.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
  });

  function tickPanel(panel, station) {
    if (!station || station.status === 'idle') return;
    const elapsed = liveElapsed(station);
    const timeEl = panel.el.querySelector('[data-st-time]');
    const costEl = panel.el.querySelector('[data-st-cost]');
    if (timeEl) timeEl.textContent = duration(elapsed);
    const agoEl = panel.el.querySelector('[data-st-ago]');
    if (agoEl) agoEl.textContent = 'Klaar om ' + clock(station.stoppedAt) + ' · ' + ago(station.stoppedAt);
    if (costEl) costEl.textContent = station.free ? 'Vrij' : euro(station.status === 'stopped' ? station.costCents : costCents(elapsed, station.pricing));
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
      const path = action === 'start-free' ? 'start?mode=free' : action;
      await api('/backoffice/api/stations/' + encodeURIComponent(folder) + '/' + path, 'POST');
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
