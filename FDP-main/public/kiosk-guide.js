// Auto-gids voor het kioskscherm: toont onderin steeds de volgende stap
// en licht het onderdeel op waar de klant nu moet klikken.
// Laden NA files-page.js, zodat de print- en voorbeeldfuncties bestaan.
(function () {
  const texts = {
    nl: {
      next: 'Volgende stap',
      scanTitle: 'Scan de QR-code met je telefoon',
      scanText: 'Open de link en upload je bestand. Het verschijnt daarna vanzelf hier op het scherm.',
      arrivedTitle: 'Je bestand is binnen!',
      arrivedText: 'Klik op de groene knop Print waar de rode pijl naar wijst. Eerst bekijken? Klik op Voorbeeld.',
      previewTitle: 'Controleer het voorbeeld',
      previewText: 'Ziet het er goed uit? Klik op de groene knop Print.',
      printedTitle: 'Kies je printer en klik op Afdrukken',
      printedText: 'Klaar met printen? Klik op Nieuwe sessie zodat je bestanden worden verwijderd.',
      endedTitle: 'Bedankt!',
      endedText: 'Je sessie is gestopt. Rond af en betaal bij de balie.',
      pointerTitle: 'Klik hier om te printen'
    },
    en: {
      next: 'Next step',
      scanTitle: 'Scan the QR code with your phone',
      scanText: 'Open the link and upload your file. It will appear here on the screen automatically.',
      arrivedTitle: 'Your file has arrived!',
      arrivedText: 'Click the green Print button the red arrow points to. Want to check first? Click Preview.',
      previewTitle: 'Check the preview',
      previewText: 'Looks good? Click the green Print button.',
      printedTitle: 'Choose your printer and click Print',
      printedText: 'Done printing? Click New session so your files are deleted.',
      endedTitle: 'Thank you!',
      endedText: 'Your session has ended. Please pay at the counter.',
      pointerTitle: 'Click here to print'
    }
  };

  const steps = ['scan', 'arrived', 'preview', 'printed'];

  const style = document.createElement('style');
  style.textContent = [
    // Stappen-popup: verschijnt boven de QR-code bij elke nieuwe stap, 5 s zichtbaar.
    '.fdp-guide{position:fixed;left:50%;top:1rem;z-index:8999;width:min(26rem,calc(100vw - 2rem));',
    'display:flex;gap:1rem;align-items:center;border-radius:1.25rem;background:#fff;color:#18181b;padding:1rem 1.25rem;',
    'box-shadow:0 20px 50px rgba(0,0,0,.28);border:2px solid #dc2626;font-family:Manrope,system-ui,sans-serif;',
    'transform:translate(-50%,-100%) translateY(18px) scale(.92);opacity:0;visibility:hidden;pointer-events:none;',
    'transition:opacity .35s ease,transform .45s cubic-bezier(.16,1,.3,1),visibility 0s linear .45s}',
    '.fdp-guide.is-visible{opacity:1;visibility:visible;transform:translate(-50%,-100%);',
    'transition:opacity .35s ease,transform .45s cubic-bezier(.16,1,.3,1),visibility 0s}',
    '.fdp-guide.is-below{transform:translate(-50%,0) translateY(-18px) scale(.92)}',
    '.fdp-guide.is-below.is-visible{transform:translate(-50%,0)}',
    '.fdp-guide::after{content:"";position:absolute;left:calc(50% + var(--tail-shift,0px));bottom:-11px;width:18px;height:18px;margin-left:-9px;background:#fff;',
    'border-right:2px solid #dc2626;border-bottom:2px solid #dc2626;transform:rotate(45deg)}',
    '.fdp-guide.is-below::after{display:none}',
    '.fdp-guide__timer{position:absolute;left:1rem;right:1rem;bottom:.45rem;height:3px;border-radius:999px;background:#fee2e2;overflow:hidden}',
    '.fdp-guide__timer span{display:block;height:100%;background:#dc2626;transform-origin:left;}',
    '.fdp-guide.is-visible .fdp-guide__timer span{animation:fdpGuideCountdown 5s linear forwards}',
    '@keyframes fdpGuideCountdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}',
    '.fdp-guide__num{flex:none;width:3rem;height:3rem;border-radius:999px;background:#dc2626;color:#fff;display:flex;',
    'align-items:center;justify-content:center;font-size:1.4rem;font-weight:800}',
    '.fdp-guide__eyebrow{margin:0;font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#dc2626}',
    '.fdp-guide__title{margin:.1rem 0 0;font-size:1.25rem;font-weight:800;line-height:1.2}',
    '.fdp-guide__text{margin:.25rem 0 0;font-size:.95rem;color:#3f3f46;line-height:1.4}',
    '.fdp-guide__dots{display:flex;gap:.35rem;margin-top:.6rem}',
    '.fdp-guide__dot{width:1.6rem;height:.3rem;border-radius:999px;background:#e4e4e7}',
    '.fdp-guide__dot--done{background:#dc2626}',
    '.fdp-guide-focus{position:relative;outline:4px solid #f59e0b !important;outline-offset:4px;border-radius:1rem;',
    'animation:fdpGuideFocus 1.4s ease-in-out infinite}',
    '@keyframes fdpGuideFocus{0%,100%{outline-color:#f59e0b}50%{outline-color:rgba(245,158,11,.25)}}',
    // Pointer: bewegende pijl met tekstballon boven de Print-knop van het bestand.
    '.fdp-pointer{position:fixed;z-index:9001;pointer-events:none;display:flex;flex-direction:column;align-items:center;',
    'transform:translate(-50%,-100%);font-family:Manrope,system-ui,sans-serif}',
    '.fdp-pointer[hidden]{display:none}',
    '.fdp-pointer{transition:opacity .4s ease}.fdp-pointer.is-fading{opacity:0}',
    '.fdp-pointer__bubble{background:#dc2626;color:#fff;font-weight:800;font-size:1rem;line-height:1.2;padding:.55rem .9rem;',
    'border-radius:.9rem;box-shadow:0 12px 28px rgba(220,38,38,.45);white-space:nowrap;text-align:center;animation:fdpPointerPop .4s ease-out}',
    '.fdp-pointer__bubble small{display:block;font-size:.72rem;font-weight:600;opacity:.9}',
    '.fdp-pointer__arrow{width:2.6rem;height:2.6rem;color:#dc2626;margin-top:-.1rem;filter:drop-shadow(0 6px 10px rgba(220,38,38,.35));',
    'animation:fdpPointerBounce .9s ease-in-out infinite}',
    '@keyframes fdpPointerBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(12px)}}',
    '@keyframes fdpPointerPop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}',
    '.fdp-print-target{position:relative;box-shadow:0 0 0 0 rgba(22,163,74,.7);animation:fdpPrintRing 1.4s ease-out infinite}',
    '@keyframes fdpPrintRing{0%{box-shadow:0 0 0 0 rgba(22,163,74,.7)}100%{box-shadow:0 0 0 14px rgba(22,163,74,0)}}',
    '@media (prefers-reduced-motion:reduce){.fdp-pointer__arrow,.fdp-print-target,.fdp-guide-focus{animation:none}.fdp-guide{transition:opacity .2s}}'
  ].join('');
  document.head.appendChild(style);

  const guide = document.createElement('div');
  guide.className = 'fdp-guide';
  guide.setAttribute('role', 'status');
  guide.setAttribute('aria-live', 'polite');
  document.body.appendChild(guide);

  const pointer = document.createElement('div');
  pointer.className = 'fdp-pointer';
  pointer.hidden = true;
  pointer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(pointer);

  let printed = false;
  let previewOpened = false;
  let lastFileCount = 0;
  let lastRenderKey = '';
  let focusedElement = null;
  let knownFiles = null;
  let newestFile = '';
  let pointerTarget = null;
  let pointerKey = '';
  let pointerUntil = 0; // tot wanneer 'Klik hier om te printen' zichtbaar is
  const pointerVisibleMs = 6000;
  const startedAt = Date.now(); // bestanden die bij het openen al in de lijst staan zijn niet 'nieuw'
  let hideTimer = null;
  const guideVisibleMs = 5000;

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

  function fileCount() {
    return document.querySelectorAll('#files-list .upload-item').length;
  }

  function previewVisible() {
    const preview = document.getElementById('preview-content');
    return Boolean(preview && !preview.classList.contains('hidden'));
  }

  function stationStatus() {
    return window.FDPStationTimer ? window.FDPStationTimer.getStatus() : 'disabled';
  }

  function currentStep() {
    if (stationStatus() === 'stopped') return 'ended';

    const count = fileCount();
    if (count === 0) {
      printed = false;
      previewOpened = false;
      lastFileCount = 0;
      return 'scan';
    }

    // A new upload arrived: start the flow for that file again.
    if (count > lastFileCount) {
      printed = false;
      previewOpened = false;
    }
    lastFileCount = count;

    if (printed) return 'printed';
    if (previewOpened && previewVisible()) return 'preview';
    return 'arrived';
  }

  function focusTarget(step) {
    if (step === 'scan') {
      const qr = document.getElementById('qr-image');
      return qr ? qr.parentElement : null;
    }
    if (step === 'arrived') return null; // de pijl wijst hier al naar de Print-knop
    if (step === 'preview') return document.getElementById('preview-print-btn');
    if (step === 'printed') return document.getElementById('new-session-btn');
    return null;
  }

  function setFocus(element) {
    if (focusedElement === element) return;
    if (focusedElement) focusedElement.classList.remove('fdp-guide-focus');
    focusedElement = element;
    if (focusedElement) focusedElement.classList.add('fdp-guide-focus');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function decodeName(encoded) {
    try { return decodeURIComponent(encoded); } catch (error) { return encoded; }
  }

  // Remember which file arrived last, and scroll it into view on arrival.
  function trackNewFiles() {
    const items = Array.from(document.querySelectorAll('#files-list .upload-item[data-encoded-file]'));
    const names = items.map(function (item) { return item.getAttribute('data-encoded-file'); });

    if (knownFiles === null) {
      knownFiles = new Set(names);
      if (names.length) newestFile = names[0];
      return;
    }

    const added = names.filter(function (name) { return !knownFiles.has(name); });
    knownFiles = new Set(names);
    if (!names.includes(newestFile)) newestFile = names[0] || '';

    if (added.length) {
      newestFile = added[added.length - 1];
      // Wijs 6 seconden lang naar de afbeelding linksboven in het album,
      // alleen bij een echte nieuwe upload (niet bij het eerste laden van de lijst).
      if (Date.now() - startedAt > 3500) pointerUntil = Date.now() + pointerVisibleMs;
      if (items[0] && items[0].scrollIntoView) items[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function findPrintButton() {
    const items = Array.from(document.querySelectorAll('#files-list .upload-item[data-encoded-file]'));
    const item = items[0]; // de tegel linksboven
    return item ? item.querySelector('.file-actions-row button') : null;
  }

  function setPointerTarget(button) {
    if (pointerTarget === button) return;
    if (pointerTarget) pointerTarget.classList.remove('fdp-print-target');
    pointerTarget = button;
    if (pointerTarget) pointerTarget.classList.add('fdp-print-target');
  }

  function positionPointer() {
    if (!pointerTarget || !pointerTarget.isConnected) {
      pointer.hidden = true;
      return;
    }
    const rect = pointerTarget.getBoundingClientRect();
    const visible = rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    pointer.hidden = !visible;
    if (!visible) return;
    pointer.style.left = Math.round(rect.left + rect.width / 2) + 'px';
    pointer.style.top = Math.round(rect.top - 6) + 'px';

    // Keep the speech bubble on screen; the arrow stays above the button.
    const bubble = pointer.querySelector('.fdp-pointer__bubble');
    if (!bubble) return;
    bubble.style.marginLeft = '0px';
    const box = bubble.getBoundingClientRect();
    const margin = 12;
    let shift = 0;
    if (box.left < margin) shift = margin - box.left;
    else if (box.right > window.innerWidth - margin) shift = (window.innerWidth - margin) - box.right;
    // marginLeft shifts a centred flex item by half its value.
    bubble.style.marginLeft = Math.round(shift * 2) + 'px';
  }

  function updatePointer(step) {
    const showPointer = step === 'arrived' && Date.now() < pointerUntil;
    const button = showPointer ? findPrintButton() : null;
    setPointerTarget(button);

    if (!button) {
      if (!pointer.hidden && !pointer.classList.contains('is-fading')) {
        pointer.classList.add('is-fading');
        setTimeout(function () { pointer.hidden = true; pointer.classList.remove('is-fading'); }, 400);
      }
      pointerKey = '';
      return;
    }

    pointer.classList.remove('is-fading');
    const item = button.closest('.upload-item');
    const targetName = item ? item.getAttribute('data-encoded-file') : newestFile;
    const key = targetName + '-' + lang();
    if (key !== pointerKey) {
      pointerKey = key;
      pointer.innerHTML = '<div class="fdp-pointer__bubble">' + t('pointerTitle')
        + '<small>' + escapeHtml(decodeName(targetName)) + '</small></div>'
        + '<svg class="fdp-pointer__arrow" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22 3 11h5V2h8v9h5z"/></svg>';
    }
    positionPointer();
  }

  function render() {
    trackNewFiles();
    const step = currentStep();
    updatePointer(step);
    const key = step + '-' + lang();
    if (key === lastRenderKey) return;

    const stepChanged = !lastRenderKey.startsWith(step + '-');
    lastRenderKey = key;

    const index = steps.indexOf(step);
    const number = step === 'ended' ? '✓' : String(index + 1);
    const dots = steps.map(function (_, i) {
      return '<span class="fdp-guide__dot' + (step === 'ended' || i <= index ? ' fdp-guide__dot--done' : '') + '"></span>';
    }).join('');

    guide.innerHTML = '<div class="fdp-guide__num">' + number + '</div>'
      + '<div><p class="fdp-guide__eyebrow">' + t('next') + '</p>'
      + '<p class="fdp-guide__title">' + t(step + 'Title') + '</p>'
      + '<p class="fdp-guide__text">' + t(step + 'Text') + '</p>'
      + '<div class="fdp-guide__dots">' + dots + '</div></div>'
      + '<div class="fdp-guide__timer"><span></span></div>';

    if (stepChanged) showGuide();
    else positionGuide();

    setFocus(focusTarget(step));
  }

  // Place the popup just above the QR code (or at the top of the screen when
  // the QR code is scrolled out of view).
  function positionGuide() {
    const qr = document.getElementById('qr-image');
    const rect = qr ? qr.getBoundingClientRect() : null;
    const room = guide.offsetHeight + 24;

    if (rect && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.top > room) {
      guide.classList.remove('is-below');
      guide.style.left = Math.round(rect.left + rect.width / 2) + 'px';
      guide.style.top = Math.round(rect.top - 14) + 'px';
    } else {
      guide.classList.add('is-below');
      guide.style.left = rect && rect.width > 0 ? Math.round(rect.left + rect.width / 2) + 'px' : '50%';
      guide.style.top = '16px';
    }

    // Keep it on screen horizontally; the little arrow keeps pointing at the QR code.
    const half = guide.offsetWidth / 2;
    const left = parseFloat(guide.style.left);
    let tailShift = 0;
    if (Number.isFinite(left)) {
      const clamped = Math.round(Math.min(Math.max(left, half + 12), window.innerWidth - half - 12));
      tailShift = Math.max(-(half - 28), Math.min(half - 28, left - clamped));
      guide.style.left = clamped + 'px';
    }
    guide.style.setProperty('--tail-shift', Math.round(tailShift) + 'px');
  }

  function showGuide() {
    positionGuide();
    guide.classList.remove('is-visible');
    void guide.offsetWidth; // restart the animation and countdown bar
    guide.classList.add('is-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { guide.classList.remove('is-visible'); }, guideVisibleMs);
  }

  function markPrinted() {
    printed = true;
    render();
  }

  // Hook into the print and preview actions of files-page.js.
  ['startPrintFlow', 'printPreview'].forEach(function (name) {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      markPrinted();
      return original.apply(this, arguments);
    };
  });

  const originalShowPreview = window.showPreview;
  if (typeof originalShowPreview === 'function') {
    window.showPreview = function () {
      const result = originalShowPreview.apply(this, arguments);
      previewOpened = true;
      Promise.resolve(result).then(render, render);
      return result;
    };
  }

  ['print-all-files', 'preview-print-btn'].forEach(function (id) {
    const button = document.getElementById(id);
    if (button) button.addEventListener('click', markPrinted);
  });

  const languageToggle = document.getElementById('language-toggle');
  if (languageToggle) {
    languageToggle.addEventListener('click', function () { setTimeout(render, 0); });
  }

  window.addEventListener('fdp-station-status', function (event) {
    render();
    // Na activeren: toon de eerste stap opnieuw, die viel weg achter de vergrendeling.
    if (event.detail && event.detail.status === 'active') {
      // Wacht tot de klant een taal heeft gekozen, zodat de pop-ups niet overlappen.
      setTimeout(function () {
        if (document.body.classList.contains('fdp-choosing-language')) {
          window.addEventListener('fdp-language-chosen', function () { lastRenderKey = ''; render(); showGuide(); }, { once: true });
        } else {
          showGuide();
        }
      }, 0);
    }
  });
  window.addEventListener('scroll', function () { if (guide.classList.contains('is-visible')) positionGuide(); }, true);
  window.addEventListener('resize', positionGuide);
  window.addEventListener('scroll', positionPointer, true);
  window.addEventListener('resize', positionPointer);
  render();
  setInterval(render, 500);
})();
