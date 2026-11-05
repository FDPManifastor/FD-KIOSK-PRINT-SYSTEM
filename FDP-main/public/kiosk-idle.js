// Inactiviteitscheck op het kioskscherm (alleen stations met "idleCheck" in
// stations.json; de server geeft dat mee in /station/status).
// Na X minuten zonder aanraking of nieuwe upload: "Ben je nog bezig?" met een
// aftelling. Geen reactie -> de tijd gaat op pauze en het personeel ziet dat in
// het overzicht. Tikt de klant daarna, dan loopt de tijd gewoon door.
// Laden NA station-timer.js.
(function () {
  const timer = window.FDPStationTimer;
  const config = window.FDPFilesPageConfig || {};
  const folder = config.folderName;
  if (!timer || !folder) return;

  const texts = {
    nl: {
      title: 'Ben je nog bezig?',
      text: 'We hebben een tijdje niets van je gezien. Reageer je niet, dan zetten we je tijd op pauze en komt een medewerker even kijken.',
      countdown: 'Pauze over {s} sec.',
      yes: 'Ja, ik ben nog bezig',
      done: 'Nee, ik ben klaar',
      pausedTitle: 'Je tijd staat op pauze',
      pausedText: 'Je was een tijdje niet actief. Tik op het scherm om verder te gaan.',
      pausedBtn: 'Verder gaan',
      staffPausedTitle: 'Je tijd staat op pauze',
      staffPausedText: 'Een medewerker heeft je tijd gepauzeerd. Vraag een medewerker om verder te gaan.'
    },
    en: {
      title: 'Are you still there?',
      text: 'We haven’t seen any activity for a while. If you don’t respond, we’ll pause your time and a staff member will check in.',
      countdown: 'Pausing in {s} sec.',
      yes: 'Yes, I’m still working',
      done: 'No, I’m done',
      pausedTitle: 'Your time is paused',
      pausedText: 'You were inactive for a while. Tap the screen to continue.',
      pausedBtn: 'Continue',
      staffPausedTitle: 'Your time is paused',
      staffPausedText: 'A staff member paused your time. Ask a staff member to continue.'
    }
  };

  const style = document.createElement('style');
  style.textContent = [
    '.fdp-idle{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:1.5rem;',
    'background:rgba(17,24,39,.55);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .3s ease;font-family:Manrope,system-ui,sans-serif}',
    '.fdp-idle.is-open{opacity:1;pointer-events:auto}',
    '.fdp-idle__card{width:min(34rem,100%);background:#fff;border-radius:1.4rem;padding:2rem 1.8rem 1.6rem;text-align:center;',
    'box-shadow:0 25px 60px rgba(0,0,0,.3);transform:translateY(16px) scale(.96);transition:transform .35s cubic-bezier(.2,.9,.3,1.2)}',
    '.fdp-idle.is-open .fdp-idle__card{transform:none}',
    '.fdp-idle__icon{width:4.2rem;height:4.2rem;margin:0 auto 1rem;border-radius:999px;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;',
    'animation:fdpIdlePulse 1.6s ease-in-out infinite}',
    '.fdp-idle__icon svg{width:2.2rem;height:2.2rem}',
    '.fdp-idle__title{margin:0;font-size:1.7rem;font-weight:900;color:#111827}',
    '.fdp-idle__text{margin:.6rem 0 0;font-size:1.05rem;line-height:1.5;color:#374151}',
    '.fdp-idle__count{margin:1rem 0 0;font-size:1.25rem;font-weight:900;color:#b45309;font-variant-numeric:tabular-nums}',
    '.fdp-idle__bar{height:.45rem;border-radius:999px;background:#fde68a;margin:.6rem 0 0;overflow:hidden}',
    '.fdp-idle__bar span{display:block;height:100%;background:#f59e0b;transform-origin:left;transition:transform 1s linear}',
    '.fdp-idle__btns{display:flex;flex-direction:column;gap:.6rem;margin-top:1.4rem}',
    '.fdp-idle__btn{border:0;border-radius:1rem;min-height:64px;padding:.9rem 1rem;font-size:1.2rem;font-weight:900;cursor:pointer}',
    '.fdp-idle__btn--yes{background:#16a34a;color:#fff}',
    '.fdp-idle__btn--done{background:#f3f4f6;color:#111827}',
    '.fdp-idle--paused .fdp-idle__icon{background:#2563eb;animation:none}',
    '.fdp-idle--paused .fdp-idle__count,.fdp-idle--paused .fdp-idle__bar{display:none}',
    '@keyframes fdpIdlePulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}50%{box-shadow:0 0 0 16px rgba(245,158,11,0)}}'
  ].join('');
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'fdp-idle';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  document.body.appendChild(overlay);

  const clockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>';
  const pauseIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>';

  let lastActivity = Date.now();
  let mode = ''; // '', 'ask', 'paused', 'staff'
  let askDeadline = 0;
  let busy = false;
  let lastFiles = null;

  function lang() {
    try { return localStorage.getItem('fdp-lang') === 'en' ? 'en' : 'nl'; } catch (error) { return 'nl'; }
  }

  function settings() {
    const station = timer.getStation();
    const idle = station && station.idleCheck;
    if (!idle) return null;
    const override = window.FDPIdleOverride || {};
    return {
      idleMs: override.idleMs || idle.minutes * 60000,
      countdownMs: override.countdownMs || idle.countdownSeconds * 1000
    };
  }

  function blocked() {
    const body = document.body.classList;
    return body.contains('fdp-kiosk-locked') || body.contains('fdp-choosing-language');
  }

  function markActive() {
    lastActivity = Date.now();
  }

  ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(function (type) {
    window.addEventListener(type, function () {
      if (mode === 'paused') return; // tik op de pauze-melding: zie click-handler
      if (mode !== 'ask') markActive();
    }, { capture: true, passive: true });
  });
  window.addEventListener('scroll', function () { if (!mode) markActive(); }, { capture: true, passive: true });

  function render() {
    const t = texts[lang()];
    overlay.classList.toggle('fdp-idle--paused', mode === 'paused' || mode === 'staff');
    if (mode === 'ask') {
      overlay.innerHTML = '<div class="fdp-idle__card"><div class="fdp-idle__icon">' + clockIcon + '</div>'
        + '<p class="fdp-idle__title">' + t.title + '</p><p class="fdp-idle__text">' + t.text + '</p>'
        + '<p class="fdp-idle__count" data-idle-count></p><div class="fdp-idle__bar"><span data-idle-bar></span></div>'
        + '<div class="fdp-idle__btns"><button type="button" class="fdp-idle__btn fdp-idle__btn--yes" data-idle="yes">' + t.yes + '</button>'
        + (timer.getStation() && timer.getStation().selfFinish ? '<button type="button" class="fdp-idle__btn fdp-idle__btn--done" data-idle="done">' + t.done + '</button>' : '')
        + '</div></div>';
      tickCountdown();
    } else if (mode === 'paused') {
      overlay.innerHTML = '<div class="fdp-idle__card"><div class="fdp-idle__icon">' + pauseIcon + '</div>'
        + '<p class="fdp-idle__title">' + t.pausedTitle + '</p><p class="fdp-idle__text">' + t.pausedText + '</p>'
        + '<div class="fdp-idle__btns"><button type="button" class="fdp-idle__btn fdp-idle__btn--yes" data-idle="continue">' + t.pausedBtn + '</button></div></div>';
    } else if (mode === 'staff') {
      overlay.innerHTML = '<div class="fdp-idle__card"><div class="fdp-idle__icon">' + pauseIcon + '</div>'
        + '<p class="fdp-idle__title">' + t.staffPausedTitle + '</p><p class="fdp-idle__text">' + t.staffPausedText + '</p></div>';
    }
    overlay.classList.toggle('is-open', !!mode);
  }

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    render();
  }

  function tickCountdown() {
    if (mode !== 'ask') return;
    const s = settings();
    const left = Math.max(0, askDeadline - Date.now());
    const count = overlay.querySelector('[data-idle-count]');
    const bar = overlay.querySelector('[data-idle-bar]');
    if (count) count.textContent = texts[lang()].countdown.replace('{s}', Math.ceil(left / 1000));
    if (bar && s) bar.style.transform = 'scaleX(' + (left / s.countdownMs) + ')';
  }

  async function post(action) {
    busy = true;
    try {
      await fetch('/station/' + action + '/' + encodeURIComponent(folder), { method: 'POST', cache: 'no-store' });
    } catch (error) { /* volgende statuscheck corrigeert */ }
    if (timer.refresh) await timer.refresh();
    busy = false;
  }

  overlay.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-idle]');
    const action = btn ? btn.getAttribute('data-idle') : (mode === 'paused' ? 'continue' : '');
    if (!action || busy) return;
    event.preventDefault();
    if (action === 'yes') {
      markActive();
      setMode('');
    } else if (action === 'done') {
      setMode('');
      post('finish');
    } else if (action === 'continue') {
      markActive();
      post('continue').then(function () { markActive(); });
    }
  });

  // Nieuwe upload vanaf de telefoon telt ook als activiteit.
  async function checkFiles() {
    if (!settings() || mode) return;
    try {
      const response = await fetch('/files/' + encodeURIComponent(folder), { cache: 'no-store' });
      const data = await response.json();
      const key = JSON.stringify(data.files || []);
      if (lastFiles !== null && key !== lastFiles) markActive();
      lastFiles = key;
    } catch (error) { /* negeer */ }
  }

  function update() {
    const s = settings();
    const station = timer.getStation();
    if (!s || !station || blocked()) {
      if (mode) setMode('');
      markActive();
      return;
    }
    if (station.status === 'paused') {
      setMode(station.pausedBy === 'idle' ? 'paused' : 'staff');
      return;
    }
    if (station.status !== 'active') {
      if (mode) setMode('');
      markActive();
      return;
    }
    if (mode === 'paused' || mode === 'staff') {
      // Weer actief (klant tikte of medewerker hervatte).
      markActive();
      setMode('');
      return;
    }
    if (mode === 'ask') {
      tickCountdown();
      if (Date.now() >= askDeadline && !busy) {
        setMode('paused');
        post('idle');
      }
      return;
    }
    if (Date.now() - lastActivity >= s.idleMs) {
      askDeadline = Date.now() + s.countdownMs;
      setMode('ask');
    }
  }

  window.addEventListener('fdp-station-status', update);
  window.addEventListener('fdp-kiosk-unlocked', markActive);
  setInterval(update, 500);
  setInterval(checkFiles, 20000);
  checkFiles();
})();
