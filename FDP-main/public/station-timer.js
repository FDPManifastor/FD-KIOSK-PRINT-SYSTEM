// Tijd en kosten rechtsonder op het kioskscherm.
// Wordt zichtbaar zodra de backoffice deze computer vrijgeeft.
// Gebruik: zet window.FDPFilesPageConfig.folderName en laad dit script.
(function () {
  const config = window.FDPFilesPageConfig || {};
  const folder = config.folderName;
  if (!folder) return;

  const pollMs = 3000;
  const texts = {
    nl: {
      label: 'Gebruikstijd',
      cost: 'Kosten',
      next: 'Volgende {price} over',
      endedTitle: 'Sessie beëindigd',
      endedText: 'Betaal bij de balie',
      total: 'Totaal',
      paused: 'Gepauzeerd',
      pausedText: 'De tijd staat stil',
      freeLabel: 'Vrije sessie',
      freeCost: 'Vrij',
      freeText: 'Geen tijdslimiet',
      freeScope: 'Computergebruik zonder kosten · printen wordt apart gerekend',
      freeEndedText: 'Vraag een medewerker om opnieuw te beginnen',
      scope: 'Opstartkosten + computergebruik · excl. printen'
    },
    en: {
      label: 'Time used',
      cost: 'Cost',
      next: 'Next {price} in',
      endedTitle: 'Session ended',
      endedText: 'Please pay at the counter',
      total: 'Total',
      paused: 'Paused',
      pausedText: 'The clock is stopped',
      freeLabel: 'Free session',
      freeCost: 'Free',
      freeText: 'No time limit',
      freeScope: 'Computer use free of charge · printing is charged separately',
      freeEndedText: 'Ask a staff member to start again',
      scope: 'Start-up fee + computer use · excl. printing'
    }
  };

  let station = { status: 'idle' };
  let loaded = false; // true after the first answer from the server
  let clockOffset = 0;

  function lang() {
    try {
      return localStorage.getItem('fdp-lang') === 'en' ? 'en' : 'nl';
    } catch (error) {
      return 'nl';
    }
  }

  function t(key) {
    return texts[lang()][key];
  }

  function euro(cents) {
    const value = (cents / 100).toFixed(2);
    return '€' + (lang() === 'nl' ? value.replace('.', ',') : value);
  }

  function duration(ms) {
    const total = Math.floor(Math.max(0, ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return (h > 0 ? h + ':' : '') + m + ':' + s;
  }

  function pricingFor(elapsedMs) {
    const p = station.pricing;
    const baseMs = p.baseMinutes * 60000;
    const stepMs = p.stepMinutes * 60000;
    const extra = elapsedMs > baseMs ? Math.ceil((elapsedMs - baseMs) / stepMs) : 0;
    const paidUntilMs = baseMs + extra * stepMs;
    return {
      costCents: p.baseCents + extra * p.stepCents,
      msUntilNext: Math.max(0, paidUntilMs - elapsedMs)
    };
  }

  const style = document.createElement('style');
  style.textContent = [
    '.fdp-station-timer{position:fixed;right:1.25rem;bottom:1.25rem;z-index:9000;min-width:15rem;border-radius:1.25rem;',
    'background:rgba(24,24,27,.94);color:#fff;padding:1rem 1.25rem;box-shadow:0 20px 50px rgba(0,0,0,.35);',
    'font-family:Manrope,system-ui,sans-serif;font-variant-numeric:tabular-nums;border:1px solid rgba(255,255,255,.12)}',
    '.fdp-station-timer[hidden]{display:none}',
    '.fdp-station-timer__row{display:flex;align-items:flex-end;justify-content:space-between;gap:1.5rem}',
    '.fdp-station-timer__label{margin:0;font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.65)}',
    '.fdp-station-timer__time{margin:.15rem 0 0;font-size:2.25rem;font-weight:800;line-height:1}',
    '.fdp-station-timer__cost{margin:.15rem 0 0;font-size:2.25rem;font-weight:800;line-height:1;color:#fca5a5;text-align:right}',
    '.fdp-station-timer__next{margin:.65rem 0 0;font-size:.8rem;font-weight:600;color:rgba(255,255,255,.7)}',
    '.fdp-station-timer__scope{margin:.35rem 0 0;padding-top:.4rem;border-top:1px solid rgba(255,255,255,.18);font-size:.72rem;font-weight:700;color:rgba(255,255,255,.75)}',
    '.fdp-station-timer--ended{background:rgba(185,28,28,.96)}',
    '.fdp-station-timer--ended .fdp-station-timer__cost{color:#fff}',
    '.fdp-station-timer--paused{background:rgba(180,83,9,.95)}',
    '.fdp-station-timer--free{background:rgba(30,64,175,.95)}',
    '.fdp-station-timer--free .fdp-station-timer__cost{color:#bfdbfe}',
    '.fdp-station-timer--paused .fdp-station-timer__cost{color:#fff}',
    '.fdp-station-timer__dot{display:inline-block;width:.5rem;height:.5rem;border-radius:999px;background:#34d399;margin-right:.4rem;',
    'animation:fdpTimerPulse 1.6s ease-in-out infinite}',
    '@keyframes fdpTimerPulse{0%,100%{opacity:1}50%{opacity:.3}}'
  ].join('');
  document.head.appendChild(style);

  const box = document.createElement('div');
  box.className = 'fdp-station-timer';
  box.hidden = true;
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'off');
  document.body.appendChild(box);

  function render() {
    if (station.status !== 'active' && station.status !== 'paused' && station.status !== 'stopped') {
      box.dataset.layout = '';
      box.hidden = true;
      return;
    }

    box.hidden = false;

    if (station.status === 'stopped') {
      box.dataset.layout = 'stopped';
      box.className = 'fdp-station-timer fdp-station-timer--ended';
      box.innerHTML = '<div class="fdp-station-timer__row">'
        + '<div><p class="fdp-station-timer__label">' + t('endedTitle') + '</p>'
        + '<p class="fdp-station-timer__time">' + duration(station.elapsedMs) + '</p></div>'
        + '<div><p class="fdp-station-timer__label" style="text-align:right">' + t('total') + '</p>'
        + '<p class="fdp-station-timer__cost">' + (station.free ? t('freeCost') : euro(station.costCents)) + '</p></div>'
        + '</div>'
        + '<p class="fdp-station-timer__next" style="color:#fff">' + (station.free ? t('freeEndedText') : t('endedText')) + '</p>'
        + '<p class="fdp-station-timer__scope">' + (station.free ? t('freeScope') : t('scope')) + '</p>';
      return;
    }

    // Server sends the paid time at serverNow; while active we add the time since.
    const paused = station.status === 'paused';
    const elapsed = station.elapsedMs + (paused ? 0 : Math.max(0, Date.now() + clockOffset - station.serverNow));
    const price = pricingFor(elapsed);
    const free = !!station.free;
    const layoutKey = station.status + '-' + lang() + (free ? '-free' : '');

    if (box.dataset.layout !== layoutKey) {
      box.dataset.layout = layoutKey;
      box.className = 'fdp-station-timer' + (paused ? ' fdp-station-timer--paused' : '') + (free ? ' fdp-station-timer--free' : '');
      box.innerHTML = '<div class="fdp-station-timer__row">'
        + '<div><p class="fdp-station-timer__label">' + (paused ? '&#10073;&#10073; ' + t('paused') : '<span class="fdp-station-timer__dot"></span>' + (free ? t('freeLabel') : t('label'))) + '</p>'
        + '<p class="fdp-station-timer__time" data-part="time"></p></div>'
        + '<div><p class="fdp-station-timer__label" style="text-align:right">' + t('cost') + '</p>'
        + '<p class="fdp-station-timer__cost" data-part="cost"></p></div>'
        + '</div>'
        + (paused
          ? '<p class="fdp-station-timer__next">' + t('pausedText') + '<span data-part="next" hidden></span></p>'
          : (free
            ? '<p class="fdp-station-timer__next">' + t('freeText') + '<span data-part="next" hidden></span></p>'
            : '<p class="fdp-station-timer__next">' + t('next').replace('{price}', euro(station.pricing.stepCents)) + ' <span data-part="next"></span></p>'))
        + '<p class="fdp-station-timer__scope">' + (free ? t('freeScope') : t('scope')) + '</p>';
    }

    box.querySelector('[data-part="time"]').textContent = duration(elapsed);
    box.querySelector('[data-part="cost"]').textContent = free ? t('freeCost') : euro(price.costCents);
    box.querySelector('[data-part="next"]').textContent = duration(price.msUntilNext);
  }

  async function poll() {
    try {
      const response = await fetch('/station/status/' + encodeURIComponent(folder), { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      clockOffset = data.serverNow - Date.now();
      const changed = !loaded || data.status !== station.status || data.startedAt !== station.startedAt;
      station = data;
      loaded = true;
      render();
      if (changed) {
        window.dispatchEvent(new CustomEvent('fdp-station-status', { detail: { status: data.status } }));
      }
    } catch (error) {
      // Netwerkfout: laat de laatst bekende stand staan.
    }
  }

  window.FDPStationTimer = {
    getStatus: function () { return loaded ? station.status : null; },
    getStation: function () { return loaded ? station : null; },
    // Betaalde tijd op dit moment (ms), ook tussen twee serverantwoorden in.
    getElapsedMs: function () {
      if (!loaded || !station || typeof station.elapsedMs !== 'number') return 0;
      if (station.status !== 'active') return station.elapsedMs;
      return station.elapsedMs + Math.max(0, Date.now() + clockOffset - station.serverNow);
    },
    getBox: function () { return box; },
    refresh: function () { return poll(); }
  };

  poll();
  setInterval(poll, pollMs);
  setInterval(render, 1000);
})();
