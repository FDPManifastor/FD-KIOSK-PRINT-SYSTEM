// Sessie-functies voor de klant op het kioskscherm (nu alleen TEST COPY 1):
// - Knop "Ik ben klaar": één tik, tijd stopt en de kiosk gaat op slot (afrekenen bij de balie)
// - Waarschuwing 1 minuut voor het einde van de eerste 10 minuten: popup die
//   vanuit het tijdblokje naar voren komt, 15 seconden, weg te tikken
// - Prijsregel "daarna ... per minuut" in de prijslijst
// Alleen actief als de server voor dit station selfFinish aangeeft.
// Laden NA station-timer.js en kiosk-lock.js.
(function () {
  const config = window.FDPFilesPageConfig || {};
  const folder = config.folderName;
  const timer = window.FDPStationTimer;
  if (!folder || !timer) return;

  const WARN_BEFORE_MS = 60 * 1000;
  const WARN_VISIBLE_MS = 15 * 1000;
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const spring = 'cubic-bezier(.34,1.56,.64,1)';

  const texts = {
    nl: {
      done: 'Ik ben klaar',
      failed: 'Niet gelukt, probeer opnieuw',
      warnEyebrow: 'Let op',
      warnTitle: 'Je eerste {base} minuten zijn bijna voorbij',
      warnText: 'Vanaf {base} minuten betaal je {price} {unit}.',
      warnLeft: 'Nog {left}',
      warnClose: 'Tik om te sluiten',
      perMinute: 'per minuut',
      perMinutes: 'per {n} minuten',
      priceRowTitle: 'Computergebruik',
      priceRowSub: 'na de eerste {base} min.'
    },
    en: {
      done: "I'm done",
      failed: 'Failed, please try again',
      warnEyebrow: 'Heads up',
      warnTitle: 'Your first {base} minutes are almost over',
      warnText: 'From {base} minutes you pay {price} {unit}.',
      warnLeft: '{left} left',
      warnClose: 'Tap to close',
      perMinute: 'per minute',
      perMinutes: 'per {n} minutes',
      priceRowTitle: 'Computer use',
      priceRowSub: 'after the first {base} min.'
    }
  };

  function lang() {
    try { return localStorage.getItem('fdp-lang') === 'en' ? 'en' : 'nl'; } catch (error) { return 'nl'; }
  }
  function t(key, vars) {
    let value = texts[lang()][key] || texts.nl[key] || key;
    Object.keys(vars || {}).forEach(function (k) { value = value.split('{' + k + '}').join(vars[k]); });
    return value;
  }
  function euro(cents) {
    const v = (cents / 100).toFixed(2);
    return '€' + (lang() === 'nl' ? v.replace('.', ',') : v);
  }
  function unitText(p) {
    return p.stepMinutes === 1 ? t('perMinute') : t('perMinutes', { n: p.stepMinutes });
  }
  function mmss(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // --------------------------------------------------------------- stijlen
  const style = document.createElement('style');
  style.textContent = [
    // Knop "Ik ben klaar", net boven het tijdblokje
    '.fdp-done,html.fdp-touch .fdp-done{position:fixed !important;overflow:visible !important;right:1.25rem;z-index:9001;display:flex;align-items:center;justify-content:center;gap:.6rem;',
    'min-width:15rem;min-height:64px;padding:.8rem 1.4rem;border:0;border-radius:1.1rem;background:#16a34a;color:#fff;',
    'font:800 1.2rem Manrope,system-ui,sans-serif;box-shadow:0 14px 32px rgba(22,163,74,.38);cursor:pointer;',
    'opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .35s ease,transform .45s ' + spring + '}',
    '.fdp-done.is-visible,html.fdp-touch .fdp-done.is-visible{opacity:1;transform:none;pointer-events:auto}',
    '.fdp-done:active,html.fdp-touch .fdp-done.is-visible:active{transform:scale(.95)}',
    '.fdp-done svg{width:26px;height:26px}',
    'body.fdp-kiosk-locked .fdp-done{display:none}',

    // Waarschuwing die uit het tijdblokje komt
    '.fdp-warn{position:fixed;right:1.25rem;z-index:9002;width:min(24rem,calc(100vw - 2.5rem));border-radius:1.25rem;',
    'background:#fff;color:#18181b;border:2px solid #f59e0b;box-shadow:0 24px 60px rgba(0,0,0,.3);padding:1.1rem 1.25rem 1.4rem;',
    'font-family:Manrope,system-ui,sans-serif;cursor:pointer;transform-origin:100% 100%;',
    'opacity:0;transform:translateY(40px) scale(.25);pointer-events:none;transition:opacity .3s ease,transform .6s ' + spring + '}',
    '.fdp-warn.is-open{opacity:1;transform:none;pointer-events:auto}',
    '.fdp-warn.is-closing{opacity:0;transform:translateY(30px) scale(.3);transition:opacity .25s ease,transform .35s ' + ease + '}',
    '.fdp-warn::after{content:"";position:absolute;right:2.2rem;bottom:-11px;width:18px;height:18px;background:#fff;',
    'border-right:2px solid #f59e0b;border-bottom:2px solid #f59e0b;transform:rotate(45deg)}',
    '.fdp-warn__row{display:flex;gap:.9rem;align-items:flex-start}',
    '.fdp-warn__icon{flex:none;width:3rem;height:3rem;border-radius:999px;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;',
    'animation:fdpWarnPulse 1.6s ease-in-out infinite}',
    '.fdp-warn__icon svg{width:1.6rem;height:1.6rem}',
    '@keyframes fdpWarnPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}50%{box-shadow:0 0 0 10px rgba(245,158,11,0)}}',
    '.fdp-warn__eyebrow{margin:0;font-size:.72rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#b45309}',
    '.fdp-warn__title{margin:.15rem 0 0;font-size:1.2rem;font-weight:800;line-height:1.25}',
    '.fdp-warn__text{margin:.35rem 0 0;font-size:1rem;line-height:1.45;color:#3f3f46}',
    '.fdp-warn__meta{display:flex;justify-content:space-between;margin-top:.6rem;font-size:.8rem;font-weight:700;color:#a16207;font-variant-numeric:tabular-nums}',
    '.fdp-warn__bar{position:absolute;left:1rem;right:1rem;bottom:.55rem;height:4px;border-radius:999px;background:#fef3c7;overflow:hidden}',
    '.fdp-warn__bar span{display:block;height:100%;background:#f59e0b;transform-origin:left;transform:scaleX(1)}',
    '.fdp-warn.is-open .fdp-warn__bar span{animation:fdpWarnBar ' + (WARN_VISIBLE_MS / 1000) + 's linear forwards}',
    '@keyframes fdpWarnBar{to{transform:scaleX(0)}}',
    // het tijdblokje geeft even een oranje gloed
    '.fdp-station-timer.fdp-timer-warn{box-shadow:0 0 0 3px #f59e0b,0 20px 50px rgba(245,158,11,.45)}',
    '@media (prefers-reduced-motion:reduce){.fdp-warn,.fdp-done{transition:opacity .2s}.fdp-warn__icon{animation:none}}'
  ].join('');
  document.head.appendChild(style);

  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  const clockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  // ---------------------------------------------------- knop "Ik ben klaar"
  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'fdp-done';
  document.body.appendChild(doneButton);

  function placeAboveTimer(el, gap) {
    const box = timer.getBox && timer.getBox();
    if (!box || box.hidden) return false;
    const r = box.getBoundingClientRect();
    el.style.bottom = Math.round(window.innerHeight - r.top + gap) + 'px';
    return true;
  }

  function station() { return timer.getStation(); }

  function updateDoneButton() {
    const st = station();
    const show = !!(st && st.selfFinish && (st.status === 'active' || st.status === 'paused'));
    if (doneButton.dataset.lang !== lang()) { doneButton.dataset.lang = lang(); doneButton.innerHTML = checkIcon + '<span>' + t('done') + '</span>'; }
    if (show && placeAboveTimer(doneButton, 12)) doneButton.classList.add('is-visible');
    else doneButton.classList.remove('is-visible');
  }

  // Eén tik: tijd stopt direct en de kiosk gaat op slot (geen bevestiging).
  let finishing = false;
  async function finishNow() {
    if (finishing) return;
    finishing = true;
    doneButton.disabled = true;
    try {
      const response = await fetch('/station/finish/' + encodeURIComponent(folder), { method: 'POST' });
      if (!response.ok && response.status !== 409) throw new Error('Status ' + response.status);
      if (timer.refresh) await timer.refresh();
    } catch (error) {
      // Mislukt: korte melding op de knop zelf, daarna weer bruikbaar.
      doneButton.dataset.lang = '';
      doneButton.innerHTML = '<span>' + t('failed') + '</span>';
      setTimeout(function () { doneButton.dataset.lang = ''; updateDoneButton(); }, 3500);
    } finally {
      finishing = false;
      doneButton.disabled = false;
    }
  }

  doneButton.addEventListener('click', finishNow);

  function computeCost(elapsedMs, p) {
    const baseMs = p.baseMinutes * 60000;
    const stepMs = p.stepMinutes * 60000;
    const extra = elapsedMs > baseMs ? Math.ceil((elapsedMs - baseMs) / stepMs) : 0;
    return p.baseCents + extra * p.stepCents;
  }

  // ----------------------------------------- waarschuwing na de 9e minuut
  const warn = document.createElement('div');
  warn.className = 'fdp-warn';
  warn.setAttribute('role', 'alert');
  document.body.appendChild(warn);
  let warnedFor = null;
  let warnTimer = null;
  let warnTick = null;

  function warnKey(st) { return 'fdp-warned-' + folder + '-' + st.startedAt; }
  function alreadyWarned(st) {
    if (warnedFor === st.startedAt) return true;
    try { return sessionStorage.getItem(warnKey(st)) === '1'; } catch (error) { return false; }
  }
  function markWarned(st) {
    warnedFor = st.startedAt;
    try { sessionStorage.setItem(warnKey(st), '1'); } catch (error) { /* ignore */ }
  }

  function renderWarn(st) {
    const p = st.pricing;
    const left = p.baseMinutes * 60000 - timer.getElapsedMs();
    warn.innerHTML = '<div class="fdp-warn__row"><div class="fdp-warn__icon">' + clockIcon + '</div><div>'
      + '<p class="fdp-warn__eyebrow">' + t('warnEyebrow') + '</p>'
      + '<p class="fdp-warn__title">' + t('warnTitle', { base: p.baseMinutes }) + '</p>'
      + '<p class="fdp-warn__text">' + t('warnText', { base: p.baseMinutes, price: euro(p.stepCents), unit: unitText(p) }) + '</p>'
      + '<div class="fdp-warn__meta"><span data-left>' + t('warnLeft', { left: mmss(left) }) + '</span><span>' + t('warnClose') + '</span></div>'
      + '</div></div><div class="fdp-warn__bar"><span></span></div>';
  }

  function showWarn(st) {
    markWarned(st);
    renderWarn(st);
    placeAboveTimer(warn, 18);
    const box = timer.getBox && timer.getBox();
    if (box) box.classList.add('fdp-timer-warn');
    doneButton.style.visibility = 'hidden'; // de waarschuwing komt op die plek
    warn.classList.remove('is-closing');
    void warn.offsetWidth;
    warn.classList.add('is-open');
    clearTimeout(warnTimer);
    warnTimer = setTimeout(hideWarn, WARN_VISIBLE_MS);
    clearInterval(warnTick);
    warnTick = setInterval(function () {
      const el = warn.querySelector('[data-left]');
      const s = station();
      if (el && s) el.textContent = t('warnLeft', { left: mmss(s.pricing.baseMinutes * 60000 - timer.getElapsedMs()) });
    }, 500);
  }

  function hideWarn() {
    if (!warn.classList.contains('is-open')) return;
    clearTimeout(warnTimer);
    clearInterval(warnTick);
    warn.classList.add('is-closing');
    warn.classList.remove('is-open');
    const box = timer.getBox && timer.getBox();
    if (box) box.classList.remove('fdp-timer-warn');
    setTimeout(function () { warn.classList.remove('is-closing'); doneButton.style.visibility = ''; }, 380);
  }

  warn.addEventListener('click', hideWarn);

  function checkWarn() {
    const st = station();
    if (!st || !st.selfFinish || st.status !== 'active' || !st.pricing) return;
    if (document.body.classList.contains('fdp-kiosk-locked')) return;
    const baseMs = st.pricing.baseMinutes * 60000;
    const elapsed = timer.getElapsedMs();
    if (elapsed >= baseMs - WARN_BEFORE_MS && elapsed < baseMs && !alreadyWarned(st)) showWarn(st);
  }

  // --------------------------------------------- prijsregel in prijslijst
  function updatePriceRow() {
    const st = station();
    const first = document.getElementById('prijzen-startup-row-1');
    if (!st || !st.selfFinish || !st.pricing || !first) return;
    const p = st.pricing;
    let row = document.getElementById('prijzen-startup-row-time');
    if (!row) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td id="prijzen-startup-row-time"></td><td class="prijs" id="prijzen-startup-row-time-price"></td>';
      first.closest('tr').after(tr);
      row = document.getElementById('prijzen-startup-row-time');
    }
    row.innerHTML = '<strong>' + t('priceRowTitle') + '</strong><br><small>' + t('priceRowSub', { base: p.baseMinutes }) + '</small>';
    document.getElementById('prijzen-startup-row-time-price').textContent = euro(p.stepCents).replace('€', '€ ') + ' ' + unitText(p).replace(/^per /, '/ ');
  }

  // ------------------------------------------------------------- lussen
  function tick() {
    updateDoneButton();
    checkWarn();
    if (warn.classList.contains('is-open')) placeAboveTimer(warn, 18);
  }

  window.addEventListener('fdp-station-status', function () {
    tick();
    updatePriceRow();
    const st = station();
    if (st && st.status !== 'active') hideWarn();
  });
  window.addEventListener('resize', tick);
  const toggle = document.getElementById('language-toggle');
  if (toggle) toggle.addEventListener('click', function () { setTimeout(function () { updatePriceRow(); tick(); }, 0); });
  setInterval(tick, 1000);
  tick();
})();
