// Blokkeert het kioskscherm zolang de computer niet is geactiveerd.
// Dan staat de prijslijst open (niet te sluiten) met de melding om een
// medewerker te vragen. Bij activeren verdwijnt de popup en is het normale
// scherm te gebruiken. Laden NA station-timer.js.
(function () {
  const modal = document.getElementById('prijzenModal');
  const content = modal ? modal.querySelector('.modal-content') : null;
  const closeButton = modal ? modal.querySelector('.close-btn') : null;
  if (!modal || !content || !window.FDPStationTimer) return;
  const computerLabel = (window.FDPFilesPageConfig && window.FDPFilesPageConfig.copyLabel) || '';

  // De popup zit in een container die 'fixed' posities verschuift; direct onder
  // <body> staat hij altijd midden in beeld en boven de gids en timer.
  if (modal.parentElement !== document.body) document.body.appendChild(modal);

  const texts = {
    nl: {
      lockedTitle: 'Deze computer is nog niet geactiveerd',
      lockedText: 'Vraag een van onze medewerkers om computer {computer} voor je te activeren. Hieronder zie je alvast onze prijzen.',
      endedTitle: 'Je sessie is afgelopen',
      endedText: 'Betaal bij de balie en noem computer {computer}. Wil je de computer opnieuw gebruiken? Vraag een van onze medewerkers.',
      endedFreeText: 'Je vrije sessie op computer {computer} is afgelopen. Wil je de computer opnieuw gebruiken? Vraag een van onze medewerkers.',
      due: 'Te betalen',
      dueScope: 'Opstartkosten + computergebruik, excl. printen',
      computer: 'Computer'
    },
    en: {
      lockedTitle: 'This computer has not been activated yet',
      lockedText: 'Please ask one of our staff members to activate computer {computer} for you. Our prices are shown below.',
      endedTitle: 'Your session has ended',
      endedText: 'Please pay at the counter and mention computer {computer}. Want to use the computer again? Ask one of our staff members.',
      endedFreeText: 'Your free session on computer {computer} has ended. Want to use the computer again? Ask one of our staff members.',
      due: 'Amount due',
      dueScope: 'Start-up fee + computer use, excl. printing',
      computer: 'Computer'
    }
  };

  const style = document.createElement('style');
  style.textContent = [
    '.fdp-lock-banner{display:flex;align-items:center;gap:1.1rem;margin:0 0 1.5rem;padding:1.1rem 1.3rem;border-radius:1rem;',
    'background:#fef2f2;border:2px solid #dc2626;color:#7f1d1d;font-family:Manrope,system-ui,sans-serif;text-align:left}',
    '.fdp-lock-banner__icon{flex:none;width:3.4rem;height:3.4rem;border-radius:999px;background:#dc2626;color:#fff;',
    'display:flex;align-items:center;justify-content:center;animation:fdpLockPulse 1.8s ease-in-out infinite}',
    '.fdp-lock-banner__icon svg{width:1.7rem;height:1.7rem}',
    '.fdp-lock-banner__title{margin:0;font-size:1.35rem;font-weight:800;color:#991b1b;line-height:1.2}',
    '.fdp-lock-banner__text{margin:.3rem 0 0;font-size:1rem;line-height:1.45}',
    '.fdp-lock-banner__pc{margin-left:auto;flex:none;text-align:center;background:#dc2626;color:#fff;border-radius:.9rem;padding:.55rem 1rem}',
    '.fdp-lock-banner__pc small{display:block;font-size:.7rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;opacity:.85}',
    '.fdp-lock-banner__pc strong{display:block;font-size:1.6rem;font-weight:900;line-height:1.1;white-space:nowrap}',
    '.fdp-lock-banner__due{flex:none;text-align:right}',
    '.fdp-lock-banner__due small{display:block;font-size:.72rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}',
    '.fdp-lock-banner__due strong{font-size:2rem;font-weight:900;color:#991b1b}',
    '.fdp-lock-banner__due em{display:block;max-width:12rem;font-style:normal;font-size:.72rem;font-weight:600;line-height:1.3;color:#7f1d1d}',
    '#prijzenModal.fdp-locked .close-btn{display:none}',
    'body.fdp-kiosk-locked .fdp-guide,body.fdp-kiosk-locked .fdp-pointer,body.fdp-kiosk-locked .fdp-station-timer{display:none !important}',
    '#prijzenModal.fdp-locked{cursor:default}',
    '@keyframes fdpLockPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}50%{box-shadow:0 0 0 12px rgba(220,38,38,0)}}',
    '@media (max-width:640px){.fdp-lock-banner{flex-wrap:wrap}.fdp-lock-banner__pc{margin-left:0}}'
  ].join('');
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.className = 'fdp-lock-banner';
  banner.setAttribute('role', 'alert');

  let locked = false;
  let bannerKey = '';
  let previousOverflow = '';

  function lang() {
    try { return localStorage.getItem('fdp-lang') === 'en' ? 'en' : 'nl'; } catch (error) { return 'nl'; }
  }

  function euro(cents) {
    const value = (cents / 100).toFixed(2);
    return '€' + (lang() === 'nl' ? value.replace('.', ',') : value);
  }

  function renderBanner(station) {
    const ended = station.status === 'stopped';
    const free = ended && !!station.free;
    const key = station.status + '-' + (station.costCents || 0) + '-' + lang() + (free ? '-free' : '');
    if (key === bannerKey) return;
    bannerKey = key;
    const t = texts[lang()];
    banner.innerHTML = '<div class="fdp-lock-banner__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">'
      + '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke-linecap="round"></path></svg></div>'
      + '<div><p class="fdp-lock-banner__title">' + (ended ? t.endedTitle : t.lockedTitle) + '</p>'
      + '<p class="fdp-lock-banner__text">' + (free ? t.endedFreeText : (ended ? t.endedText : t.lockedText)).replace('{computer}', '<strong>' + computerLabel + '</strong>') + '</p></div>'
      + (computerLabel ? '<div class="fdp-lock-banner__pc"><small>' + t.computer + '</small><strong>' + computerLabel + '</strong></div>' : '')
      + (ended && !free ? '<div class="fdp-lock-banner__due"><small>' + t.due + '</small><strong>' + euro(station.costCents) + '</strong><em>' + t.dueScope + '</em></div>' : '');
  }

  function lock(station) {
    renderBanner(station);
    if (!banner.isConnected) content.insertBefore(banner, content.firstChild);
    if (locked && modal.classList.contains('is-open')) return;

    if (!locked) previousOverflow = document.body.style.overflow;
    locked = true;
    modal.classList.add('is-open', 'fdp-locked');
    document.body.classList.add('fdp-kiosk-locked');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    content.scrollTop = 0;
  }

  function unlock() {
    if (!locked) return;
    locked = false;
    bannerKey = '';
    banner.remove();
    modal.classList.remove('is-open', 'fdp-locked');
    document.body.classList.remove('fdp-kiosk-locked');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = previousOverflow || '';
    // Laat andere onderdelen (bijv. de taalkeuze) weten dat de computer net is geactiveerd.
    window.dispatchEvent(new CustomEvent('fdp-kiosk-unlocked'));
  }

  function update() {
    const station = window.FDPStationTimer.getStation();
    if (!station) return; // nog geen antwoord van de server
    if (station.status === 'idle' || station.status === 'stopped') lock(station);
    else unlock(); // active, paused, of timer niet ingeschakeld
  }

  // While locked, the price list cannot be closed (close button, backdrop, Escape).
  document.addEventListener('click', function (event) {
    if (!locked) return;
    if (event.target === modal || (closeButton && closeButton.contains(event.target))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  window.addEventListener('keydown', function (event) {
    if (locked && event.key === 'Escape') event.stopImmediatePropagation();
  }, true);

  const languageToggle = document.getElementById('language-toggle');
  if (languageToggle) languageToggle.addEventListener('click', function () { setTimeout(update, 0); });

  window.addEventListener('fdp-station-status', update);
  setInterval(update, 1000);
  update();
})();
