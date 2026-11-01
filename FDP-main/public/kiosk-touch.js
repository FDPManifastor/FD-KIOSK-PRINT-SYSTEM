// Touchscreen-modus voor het kioskscherm (nu alleen TEST COPY 1).
// - Tik op een bestand opent het voorbeeld (hover bestaat niet op touch)
// - Grote knoppen: Print als hoofdknop, Verwijderen apart
// - Eigen grote bevestig-pop-ups in plaats van de kleine browser-pop-up
// - Kiosk-gedrag: geen zoomen, tekst selecteren of lang-indrukken-menu
// - Tik-feedback (indrukken + ripple) en vloeiende animaties
// Laden NA files-page.js.
(function () {
  const root = document.documentElement;
  root.classList.add('fdp-touch');

  const texts = {
    nl: {
      deleteTitle: 'Bestand verwijderen?',
      deleteText: 'Dit bestand wordt van deze computer verwijderd.',
      deleteYes: 'Ja, verwijderen',
      sessionTitle: 'Klaar met printen?',
      sessionText: 'Al je bestanden worden van deze computer verwijderd, zodat de volgende klant ze niet ziet.',
      sessionYes: 'Ja, ik ben klaar',
      cancel: 'Nee, terug'
    },
    en: {
      deleteTitle: 'Delete this file?',
      deleteText: 'This file will be removed from this computer.',
      deleteYes: 'Yes, delete',
      sessionTitle: 'Done printing?',
      sessionText: 'All your files will be removed from this computer, so the next customer cannot see them.',
      sessionYes: "Yes, I'm done",
      cancel: 'No, go back'
    }
  };

  function lang() {
    try { return localStorage.getItem('fdp-lang') === 'en' ? 'en' : 'nl'; } catch (error) { return 'nl'; }
  }

  // ---------------------------------------------------------------- styles
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const spring = 'cubic-bezier(.34,1.56,.64,1)';
  const style = document.createElement('style');
  style.textContent = [
    // Kiosk-gedrag
    'html.fdp-touch{touch-action:manipulation;-webkit-tap-highlight-color:transparent;overscroll-behavior:none;scroll-behavior:smooth}',
    'html.fdp-touch body{overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    'html.fdp-touch input,html.fdp-touch select,html.fdp-touch textarea{-webkit-user-select:text;user-select:text}',
    'html.fdp-touch img{-webkit-user-drag:none;user-drag:none}',

    // Geen "hangende" hover-effecten en geen hover-voorbeelden op touch
    'html.fdp-touch .file-preview-popover{display:none !important}',
    'html.fdp-touch .soft-btn:hover,html.fdp-touch .file-action-btn:hover,html.fdp-touch .flyer-prijs-button:hover{transform:none}',

    // Tik-feedback: indrukken met een veerkrachtige terugvering
    'html.fdp-touch button,html.fdp-touch .soft-btn,html.fdp-touch .file-action-btn,html.fdp-touch .flyer-prijs-button{position:relative;overflow:hidden;',
    'transition:transform .35s ' + spring + ',box-shadow .3s ' + ease + ',background-color .2s ease,opacity .2s ease}',
    'html.fdp-touch button:active:not(:disabled),html.fdp-touch .soft-btn:active,html.fdp-touch .file-action-btn:active,html.fdp-touch .flyer-prijs-button:active',
    '{transform:scale(.95);transition-duration:.08s}',
    '.fdp-ripple{position:absolute;border-radius:50%;pointer-events:none;background:currentColor;opacity:.28;transform:scale(0);',
    'animation:fdpRipple .55s ' + ease + ' forwards}',
    '@keyframes fdpRipple{to{transform:scale(1);opacity:0}}',

    // Grote knoppen bovenaan de lijst en bij het voorbeeld
    'html.fdp-touch #language-toggle{min-height:56px;min-width:84px;font-size:1.15rem;padding:.75rem 1.2rem}',
    'html.fdp-touch #new-session-btn,html.fdp-touch #openPrijzenBtn{min-height:60px;font-size:1.1rem}',
    'html.fdp-touch #refresh-files,html.fdp-touch #download-all-files,html.fdp-touch #print-all-files,html.fdp-touch #open-edit-layout-modal',
    '{min-height:52px;font-size:.95rem;padding:.7rem 1.1rem}',
    'html.fdp-touch #preview-print-btn{min-height:64px;min-width:200px;font-size:1.2rem;padding:.9rem 2rem}',
    'html.fdp-touch .close-btn{width:60px;height:60px;display:flex;align-items:center;justify-content:center;font-size:44px;right:14px;top:10px;border-radius:999px}',
    'html.fdp-touch .close-btn:active{background:#f4f4f5}',

    // Bestandskaart: groter, hele kaart is tikbaar
    'html.fdp-touch .upload-item{padding:1rem !important;border-radius:1.1rem !important;cursor:pointer;',
    'transition:transform .35s ' + spring + ',box-shadow .3s ' + ease + ',border-color .25s ease;animation:fdpItemIn .5s ' + ease + ' backwards}',
    'html.fdp-touch .upload-item:nth-child(2){animation-delay:.05s}html.fdp-touch .upload-item:nth-child(3){animation-delay:.1s}',
    'html.fdp-touch .upload-item:nth-child(n+4){animation-delay:.15s}',
    'html.fdp-touch .upload-item:active{transform:scale(.985)}',
    'html.fdp-touch .upload-item.fdp-selected{border-color:#dc2626 !important;box-shadow:0 0 0 3px rgba(220,38,38,.18),0 12px 26px rgba(15,23,42,.12) !important}',
    '@keyframes fdpItemIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}',
    'html.fdp-touch .file-name{font-size:1.05rem;line-height:1.35}',
    'html.fdp-touch .preview-trigger-icon{width:48px;height:48px;min-width:48px}',
    'html.fdp-touch .preview-trigger-icon svg{width:22px;height:22px}',

    // Actieknoppen: Print groot bovenaan, Voorbeeld/Download/PDF eronder, Verwijderen apart
    'html.fdp-touch .file-actions-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;overflow:visible;margin-top:.4rem}',
    'html.fdp-touch .file-action-btn{justify-content:center;align-items:center;gap:.45rem;font-size:1rem;height:58px;padding:0 .8rem;',
    'white-space:nowrap;text-decoration:none;box-sizing:border-box}',
    'html.fdp-touch .file-action-btn .action-icon{display:inline-block;width:20px;height:20px;flex:0 0 20px}',
    'html.fdp-touch .file-action-btn .action-label-full{display:inline}',
    'html.fdp-touch .file-action-btn .action-label-short{display:none}',
    'html.fdp-touch .file-actions-row>:nth-child(1){grid-column:1/-1;order:0;height:74px;font-size:1.35rem;font-weight:800;',
    'background:#16a34a !important;color:#fff !important;box-shadow:0 12px 26px rgba(22,163,74,.32)}',
    'html.fdp-touch .file-actions-row>:nth-child(1) .action-icon{width:26px;height:26px;flex-basis:26px}',
    'html.fdp-touch .file-actions-row>:nth-child(3){order:1}',
    'html.fdp-touch .file-actions-row>:nth-child(2){order:2}',
    'html.fdp-touch .file-actions-row>:nth-child(4){order:3}',
    'html.fdp-touch .file-actions-row>:nth-child(5){grid-column:1/-1;order:4;justify-self:end;height:48px;font-size:.9rem;',
    'margin-top:.35rem;padding:.5rem 1.1rem;background:transparent !important;color:#b91c1c !important;border:1.5px solid #fecaca !important}',

    // Vloeiende overgangen voor voorbeeld en pop-ups
    'html.fdp-touch #preview-content:not(.hidden){animation:fdpFadeUp .45s ' + ease + '}',
    '@keyframes fdpFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
    'html.fdp-touch .modal.is-open{animation:fdpFade .25s ease}',
    '@keyframes fdpFade{from{opacity:0}to{opacity:1}}',

    // Bevestig-pop-up
    '.fdp-confirm{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:1.5rem;',
    'background:rgba(15,15,15,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .25s ease}',
    '.fdp-confirm.is-open{opacity:1}',
    '.fdp-confirm__card{width:min(30rem,100%);background:#fff;border-radius:1.6rem;padding:2rem 1.75rem 1.5rem;text-align:center;',
    'box-shadow:0 30px 80px rgba(0,0,0,.3);font-family:Manrope,system-ui,sans-serif;transform:translateY(24px) scale(.94);',
    'transition:transform .45s ' + spring + '}',
    '.fdp-confirm.is-open .fdp-confirm__card{transform:none}',
    '.fdp-confirm__icon{width:4rem;height:4rem;margin:0 auto 1rem;border-radius:999px;display:flex;align-items:center;justify-content:center;',
    'background:#fee2e2;color:#dc2626}',
    '.fdp-confirm__icon svg{width:2rem;height:2rem}',
    '.fdp-confirm__title{margin:0;font-size:1.6rem;font-weight:800;color:#18181b}',
    '.fdp-confirm__text{margin:.6rem 0 0;font-size:1.05rem;line-height:1.5;color:#52525b}',
    '.fdp-confirm__actions{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:1.6rem}',
    '.fdp-confirm__btn{border:0;border-radius:999px;min-height:62px;font-size:1.1rem;font-weight:800;cursor:pointer;font-family:inherit}',
    '.fdp-confirm__btn--no{background:#f4f4f5;color:#27272a}',
    '.fdp-confirm__btn--yes{background:#dc2626;color:#fff;box-shadow:0 10px 24px rgba(220,38,38,.3)}',

    '@media (prefers-reduced-motion:reduce){html.fdp-touch *{animation-duration:.01ms !important;transition-duration:.01ms !important;scroll-behavior:auto !important}}'
  ].join('');
  document.head.appendChild(style);

  // Zoomen blokkeren (ook als de viewport-meta wordt genegeerd).
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  document.addEventListener('touchmove', function (event) {
    if (event.touches && event.touches.length > 1) event.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', function (event) { event.preventDefault(); });
  document.addEventListener('wheel', function (event) { if (event.ctrlKey) event.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  document.addEventListener('dragstart', function (event) {
    if (event.target && event.target.tagName === 'IMG') event.preventDefault();
  });

  // ---------------------------------------------------------------- ripple
  const rippleTargets = 'button, .soft-btn, .file-action-btn, .flyer-prijs-button';
  document.addEventListener('pointerdown', function (event) {
    const target = event.target.closest(rippleTargets);
    if (!target || target.disabled) return;
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const ripple = document.createElement('span');
    ripple.className = 'fdp-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';
    target.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 600);
  }, { passive: true });

  // ---------------------------------------------------- tik op bestand = voorbeeld
  const filesList = document.getElementById('files-list');
  function markSelected(item) {
    document.querySelectorAll('#files-list .upload-item.fdp-selected').forEach(function (el) {
      if (el !== item) el.classList.remove('fdp-selected');
    });
    if (item) item.classList.add('fdp-selected');
  }

  if (filesList) {
    filesList.addEventListener('click', function (event) {
      const item = event.target.closest('.upload-item[data-encoded-file]');
      if (!item) return;
      const isTrigger = event.target.closest('.preview-trigger-icon');
      if (!isTrigger && event.target.closest('button, a')) {
        markSelected(item);
        return;
      }
      markSelected(item);
      if (typeof window.showPreview === 'function') window.showPreview(item.getAttribute('data-encoded-file'));
    });
  }

  // --------------------------------------------------------- bevestig-pop-up
  function askConfirm(kind) {
    const t = texts[lang()];
    const isDelete = kind === 'delete';
    return new Promise(function (resolve) {
      const overlay = document.createElement('div');
      overlay.className = 'fdp-confirm';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = '<div class="fdp-confirm__card">'
        + '<div class="fdp-confirm__icon">' + (isDelete
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>')
        + '</div>'
        + '<p class="fdp-confirm__title">' + (isDelete ? t.deleteTitle : t.sessionTitle) + '</p>'
        + '<p class="fdp-confirm__text">' + (isDelete ? t.deleteText : t.sessionText) + '</p>'
        + '<div class="fdp-confirm__actions">'
        + '<button type="button" class="fdp-confirm__btn fdp-confirm__btn--no">' + t.cancel + '</button>'
        + '<button type="button" class="fdp-confirm__btn fdp-confirm__btn--yes">' + (isDelete ? t.deleteYes : t.sessionYes) + '</button>'
        + '</div></div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(function () { overlay.classList.add('is-open'); });

      function close(result) {
        overlay.classList.remove('is-open');
        setTimeout(function () { overlay.remove(); }, 260);
        resolve(result);
      }
      overlay.querySelector('.fdp-confirm__btn--no').addEventListener('click', function () { close(false); });
      overlay.querySelector('.fdp-confirm__btn--yes').addEventListener('click', function () { close(true); });
      overlay.addEventListener('click', function (event) { if (event.target === overlay) close(false); });
    });
  }

  // Onderschep klikken die de browser-pop-up zouden tonen; na "ja" voeren we
  // dezelfde actie uit met de browser-pop-up automatisch bevestigd.
  function confirmKind(target) {
    if (target.closest('#new-session-btn')) return 'session';
    const btn = target.closest('button[onclick]');
    if (btn && /deleteFile\(/.test(btn.getAttribute('onclick') || '')) return 'delete';
    return null;
  }

  document.addEventListener('click', function (event) {
    const kind = confirmKind(event.target);
    if (!kind) return;
    const trigger = kind === 'session' ? event.target.closest('#new-session-btn') : event.target.closest('button[onclick]');
    if (trigger.dataset.fdpConfirmed === '1') return;

    event.stopImmediatePropagation();
    event.preventDefault();
    askConfirm(kind).then(function (ok) {
      if (!ok || !trigger.isConnected) return;
      const originalConfirm = window.confirm;
      window.confirm = function () { return true; };
      trigger.dataset.fdpConfirmed = '1';
      try {
        trigger.click();
      } finally {
        delete trigger.dataset.fdpConfirmed;
        window.confirm = originalConfirm;
      }
    });
  }, true);
})();
