// Kioskscherm (nu alleen TEST COPY 1):
// - De handleiding-kolom verdwijnt; de uploads krijgen twee keer zoveel ruimte
// - Een rinkelend Handleiding-knopje met gloed opent de handleiding in een pop-up
// - Bestanden als fotoalbum: raster van miniaturen, soepel scrollen
// Laden NA files-page.js.
(function () {
  const config = window.FDPFilesPageConfig || {};
  const folder = config.folderName;
  if (!folder) return;

  const texts = {
    nl: { manual: 'Handleiding', close: 'Sluiten' },
    en: { manual: 'Instructions', close: 'Close' }
  };
  function lang() {
    try { return localStorage.getItem('fdp-lang') === 'en' ? 'en' : 'nl'; } catch (error) { return 'nl'; }
  }

  const ease = 'cubic-bezier(.16,1,.3,1)';
  const spring = 'cubic-bezier(.34,1.56,.64,1)';
  const style = document.createElement('style');
  style.textContent = [
    // ---------- Handleiding-knop: rinkelt als een oude telefoon, met gloed
    '.fdp-manual-btn{position:fixed;left:1.25rem;bottom:1.25rem;z-index:8998;display:flex;align-items:center;gap:.8rem;border:0;',
    'padding:.55rem 1.4rem .55rem .55rem;border-radius:999px;background:#fff;color:#991b1b;font:800 1.1rem/1 Manrope,system-ui,sans-serif;',
    'box-shadow:0 14px 34px rgba(220,38,38,.28);cursor:pointer;transition:transform .35s ' + spring + '}',
    '.fdp-manual-btn:active{transform:scale(.94)}',
    '.fdp-manual-btn__icon{position:relative;width:60px;height:60px;border-radius:999px;background:#dc2626;color:#fff;',
    'display:flex;align-items:center;justify-content:center;animation:fdpGlow 2.4s ease-in-out infinite}',
    '.fdp-manual-btn__icon svg{width:32px;height:32px;transform-origin:50% 60%;animation:fdpRing 2.4s ease-in-out infinite}',
    // twee uitdijende kringen, als het geluid van een bel
    '.fdp-manual-btn__icon::before,.fdp-manual-btn__icon::after{content:"";position:absolute;inset:0;border-radius:999px;',
    'border:2px solid rgba(220,38,38,.55);animation:fdpRingWave 2.4s ease-out infinite;pointer-events:none}',
    '.fdp-manual-btn__icon::after{animation-delay:.25s}',
    '@keyframes fdpRing{0%{transform:rotate(0)}4%{transform:rotate(-20deg)}8%{transform:rotate(18deg)}12%{transform:rotate(-16deg)}',
    '16%{transform:rotate(14deg)}20%{transform:rotate(-10deg)}24%{transform:rotate(8deg)}28%{transform:rotate(-4deg)}32%,100%{transform:rotate(0)}}',
    '@keyframes fdpGlow{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.0),0 0 18px rgba(239,68,68,.35)}',
    '15%{box-shadow:0 0 0 6px rgba(220,38,38,.18),0 0 30px rgba(239,68,68,.75)}40%{box-shadow:0 0 0 0 rgba(220,38,38,0),0 0 18px rgba(239,68,68,.35)}}',
    '@keyframes fdpRingWave{0%{transform:scale(1);opacity:.9}35%{transform:scale(1.55);opacity:0}100%{transform:scale(1.55);opacity:0}}',
    'body.fdp-kiosk-locked .fdp-manual-btn{display:none}',

    // ---------- Handleiding-pop-up
    '.fdp-manual{position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;padding:1.5rem;',
    'background:rgba(15,15,15,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;visibility:hidden;',
    'transition:opacity .3s ease,visibility 0s linear .3s}',
    '.fdp-manual.is-open{opacity:1;visibility:visible;transition:opacity .3s ease,visibility 0s}',
    '.fdp-manual__card{position:relative;width:min(40rem,100%);max-height:88vh;overflow-y:auto;background:#fff;color:#18181b;border-radius:1.75rem;',
    'padding:2rem 2rem 1.5rem;box-shadow:0 30px 80px rgba(0,0,0,.3);transform:translateY(28px) scale(.94);transition:transform .5s ' + spring + '}',
    '.fdp-manual.is-open .fdp-manual__card{transform:none}',
    '.fdp-manual__card ol{list-style:none;padding:0;margin:0}',
    '.fdp-manual__card ol{counter-reset:fdpstep}',
    '.fdp-manual__card li{counter-increment:fdpstep;position:relative;font-size:1.15rem;line-height:1.45;padding:1rem 1.2rem 1rem 4.2rem;margin:0 0 .7rem;',
    'border-radius:1rem;background:#fef2f2;border:1px solid #fee2e2;opacity:0;transform:translateX(-14px)}',
    '.fdp-manual__card li::before{content:counter(fdpstep);position:absolute;left:1rem;top:50%;margin-top:-1.2rem;width:2.4rem;height:2.4rem;',
    'border-radius:999px;background:#dc2626;color:#fff;font:800 1.15rem/2.4rem Manrope,system-ui,sans-serif;text-align:center}',
    '.fdp-manual__card #guide-title{font:900 2rem/1.15 Manrope,system-ui,sans-serif;margin:0 0 1.2rem}',
    '.fdp-manual.is-open .fdp-manual__card li{animation:fdpStepIn .5s ' + ease + ' forwards}',
    '.fdp-manual.is-open .fdp-manual__card li:nth-child(2){animation-delay:.07s}',
    '.fdp-manual.is-open .fdp-manual__card li:nth-child(3){animation-delay:.14s}',
    '.fdp-manual.is-open .fdp-manual__card li:nth-child(4){animation-delay:.21s}',
    '@keyframes fdpStepIn{to{opacity:1;transform:none}}',
    '.fdp-manual__close{display:block;width:100%;margin-top:1.2rem;min-height:62px;border:0;border-radius:999px;background:#dc2626;color:#fff;',
    'font:800 1.15rem Manrope,system-ui,sans-serif;cursor:pointer;transition:transform .35s ' + spring + '}',
    '.fdp-manual__close:active{transform:scale(.96)}',

    // ---------- Fotoalbum (ID in de selector zodat het boven de touch-stijl wint)
    '.fdp-album-scroll{max-height:72vh !important;scroll-behavior:smooth;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;',
    'scroll-snap-type:y proximity;scroll-padding:.5rem;padding:.25rem .35rem .5rem .25rem}',
    '.fdp-album #files-list:not(.hidden){display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;list-style:none;padding:0;margin:0}',
    '.fdp-album #files-list>li.upload-item{display:flex;flex-direction:column;margin:0 !important;padding:0 !important;overflow:hidden;',
    'border-radius:1.15rem !important;background:#fff;scroll-snap-align:start;border:2px solid #e4e4e7}',
    // miniatuur
    '.fdp-album #files-list .fdp-thumb{order:1;position:relative;aspect-ratio:1/1;background:linear-gradient(135deg,#f4f4f5,#e4e4e7);overflow:hidden}',
    '.fdp-album #files-list .fdp-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.06);',
    'transition:opacity .45s ease,transform .7s ' + ease + '}',
    '.fdp-album #files-list .fdp-thumb img.is-loaded{opacity:1;transform:none}',
    '.fdp-album #files-list .fdp-thumb__doc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4rem}',
    '.fdp-album #files-list .fdp-thumb__doc svg{width:56px;height:56px;color:#a1a1aa}',
    '.fdp-album #files-list .fdp-thumb__ext{font:800 .8rem Manrope,system-ui,sans-serif;letter-spacing:.08em;color:#fff;border-radius:.4rem;padding:.2rem .5rem;background:#71717a}',
    '.fdp-album #files-list .fdp-thumb__ext--pdf{background:#dc2626}.fdp-album #files-list .fdp-thumb__ext--doc{background:#2563eb}',
    // bijschrift
    '.fdp-album #files-list .upload-item>.fdp-caption{order:2;margin:0 !important;padding:.6rem .75rem .1rem;align-items:center;gap:.4rem}',
    '.fdp-album #files-list .preview-trigger-icon{display:none}',
    '.fdp-album #files-list .file-name{font-size:.88rem;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    // acties: Print groot, Download / PDF / Verwijderen als ronde icoonknoppen
    '.fdp-album #files-list .file-actions-row{order:3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0;padding:.45rem .6rem .7rem;overflow:visible}',
    '.fdp-album #files-list .file-actions-row>*{grid-column:auto;justify-self:stretch;margin:0;height:44px;min-height:0;padding:0;border-radius:999px}',
    '.fdp-album #files-list .file-actions-row>:nth-child(1){order:0;grid-column:1/-1;height:50px;font-size:1.05rem}',
    '.fdp-album #files-list .file-actions-row>:nth-child(1) .action-icon{width:20px;height:20px;flex-basis:20px}',
    '.fdp-album #files-list .file-actions-row>:nth-child(3){display:none}',
    '.fdp-album #files-list .file-actions-row>:nth-child(2){order:1}',
    '.fdp-album #files-list .file-actions-row>:nth-child(4){order:2}',
    '.fdp-album #files-list .file-actions-row>:nth-child(5){order:3;border:1.5px solid #fecaca !important;background:#fff !important;color:#b91c1c !important}',
    '.fdp-album #files-list .file-actions-row>:not(:nth-child(1)) .action-label-full,',
    '.fdp-album #files-list .file-actions-row>:not(:nth-child(1)) .action-label-short,',
    '.fdp-album #files-list .file-actions-row>:nth-child(4){font-size:0 !important}',
    '.fdp-album #files-list .file-actions-row>:not(:nth-child(1)) .action-icon{display:inline-block;width:20px;height:20px;flex:0 0 20px}',
    '.fdp-album #files-list .file-actions-row>:not(:nth-child(1)){display:flex;align-items:center;justify-content:center}',
    '.fdp-album #files-list .file-actions-row>:nth-child(3){display:none}',

    '@media (prefers-reduced-motion:reduce){.fdp-manual-btn__icon,.fdp-manual-btn__icon svg,.fdp-manual-btn__icon::before,.fdp-manual-btn__icon::after{animation:none}}'
  ].join('');
  document.head.appendChild(style);

  // ------------------------------------------------------------------ layout
  const guideTitle = document.getElementById('guide-title');
  const guideCard = guideTitle ? guideTitle.parentElement : null;
  const uploadsTitle = document.getElementById('uploads-title');
  const uploadsCard = uploadsTitle ? uploadsTitle.closest('.xl\\:col-span-4') : null;

  const manual = document.createElement('div');
  manual.className = 'fdp-manual';
  manual.setAttribute('role', 'dialog');
  manual.setAttribute('aria-modal', 'true');
  manual.innerHTML = '<div class="fdp-manual__card"></div>';
  const manualCard = manual.firstChild;
  document.body.appendChild(manual);

  if (guideCard) {
    // Verplaats de inhoud (titel, stappen, tip) naar de pop-up. De id's blijven
    // gelijk, dus de vertalingen van files-page.js blijven gewoon werken.
    while (guideCard.firstChild) manualCard.appendChild(guideCard.firstChild);
    guideCard.remove();
  }

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'fdp-manual__close';
  manualCard.appendChild(closeButton);

  if (uploadsCard) {
    uploadsCard.classList.remove('xl:col-span-4');
    uploadsCard.classList.add('xl:col-span-8', 'fdp-album');
    const scroller = document.getElementById('files-list') && document.getElementById('files-list').parentElement;
    if (scroller) scroller.classList.add('fdp-album-scroll');
  }

  const manualButton = document.createElement('button');
  manualButton.type = 'button';
  manualButton.className = 'fdp-manual-btn';
  manualButton.innerHTML = '<span class="fdp-manual-btn__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H10a2 2 0 0 1 2 2v15a2.5 2.5 0 0 0-2.5-2.5H2z"/>'
    + '<path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H14a2 2 0 0 0-2 2v15a2.5 2.5 0 0 1 2.5-2.5H22z"/></svg></span>'
    + '<span class="fdp-manual-btn__label"></span>';
  document.body.appendChild(manualButton);

  function applyTexts() {
    const t = texts[lang()];
    manualButton.querySelector('.fdp-manual-btn__label').textContent = t.manual;
    manualButton.setAttribute('aria-label', t.manual);
    closeButton.textContent = t.close;
  }

  function openManual() { manual.classList.add('is-open'); }
  function closeManual() { manual.classList.remove('is-open'); }

  manualButton.addEventListener('click', openManual);
  closeButton.addEventListener('click', closeManual);
  manual.addEventListener('click', function (event) { if (event.target === manual) closeManual(); });
  window.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeManual(); });

  const languageToggle = document.getElementById('language-toggle');
  if (languageToggle) languageToggle.addEventListener('click', function () { setTimeout(applyTexts, 0); });
  applyTexts();

  // ------------------------------------------------------------------- album
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif'];
  const docIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 3h7l5 5v13H7z" stroke-linejoin="round"/><path d="M14 3v5h5" stroke-linejoin="round"/></svg>';
  const trashIcon = '<span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  function extensionOf(name) {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  }

  function docTile(ext) {
    const kind = ext === 'pdf' ? ' fdp-thumb__ext--pdf' : (ext === 'doc' || ext === 'docx' ? ' fdp-thumb__ext--doc' : '');
    return '<div class="fdp-thumb__doc">' + docIcon + '<span class="fdp-thumb__ext' + kind + '">' + (ext || 'FILE').toUpperCase() + '</span></div>';
  }

  function enhanceItem(item) {
    if (item.dataset.album === '1') return;
    item.dataset.album = '1';
    const encoded = item.getAttribute('data-encoded-file') || '';
    let name = encoded;
    try { name = decodeURIComponent(encoded); } catch (error) { /* keep encoded */ }
    const ext = extensionOf(name);

    const thumb = document.createElement('div');
    thumb.className = 'fdp-thumb';

    if (imageExtensions.includes(ext)) {
      const img = document.createElement('img');
      img.alt = name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      let triedOriginal = false;
      img.addEventListener('load', function () { img.classList.add('is-loaded'); });
      img.addEventListener('error', function () {
        if (!triedOriginal) {
          triedOriginal = true;
          img.src = '/preview/' + folder + '/' + encoded; // terugval: originele afbeelding
          return;
        }
        img.remove();
        thumb.innerHTML = docTile(ext);
      });
      img.src = '/thumb/' + folder + '/' + encoded;
      thumb.appendChild(img);
    } else {
      thumb.innerHTML = docTile(ext);
    }

    const caption = item.firstElementChild;
    if (caption) caption.classList.add('fdp-caption');
    item.insertBefore(thumb, item.firstChild);

    // Verwijderen-knop heeft geen icoon; voeg een prullenbak toe voor de icoonknop.
    const deleteButton = item.querySelector('.file-actions-row > :nth-child(5)');
    if (deleteButton && !deleteButton.querySelector('.action-icon')) {
      deleteButton.insertAdjacentHTML('afterbegin', trashIcon);
      deleteButton.setAttribute('aria-label', deleteButton.textContent.trim());
    }
    item.querySelectorAll('.file-actions-row > a, .file-actions-row > button').forEach(function (el) {
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.trim());
    });
  }

  const filesList = document.getElementById('files-list');
  if (filesList) {
    const enhanceAll = function () { filesList.querySelectorAll('.upload-item[data-encoded-file]').forEach(enhanceItem); };
    new MutationObserver(enhanceAll).observe(filesList, { childList: true });
    enhanceAll();

    // Zonder touch-script: tik op de tegel opent ook het voorbeeld.
    if (!document.documentElement.classList.contains('fdp-touch')) {
      filesList.addEventListener('click', function (event) {
        const item = event.target.closest('.upload-item[data-encoded-file]');
        if (!item || event.target.closest('button, a')) return;
        if (typeof window.showPreview === 'function') window.showPreview(item.getAttribute('data-encoded-file'));
      });
    }
  }
})();
