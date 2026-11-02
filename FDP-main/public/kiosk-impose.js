// Impose-venster: afbeelding op maat maken binnen het A4/A3-kader.
//
// Standen
// - Passend: hele afbeelding in verhouding, grootte 5-100% van het kader
// - Vullen: kader helemaal vullen; sleep om te kiezen welk deel zichtbaar blijft
// - Vrij formaat: breedte en hoogte los; Uitrekken of Bijsnijden
//
// Bediening (touch en muis)
// - Tik op de afbeelding: selectiekader met grepen (hoeken in Passend, 8 in Vrij formaat)
// - Sleep de afbeelding: verplaatsen, klikt vast in het midden
// - Knijp met twee vingers: groter/kleiner
// - Knoppen: Draai 90°, Centreren, Ongedaan maken, Passend maken
// - Fotoformaten (9x13 ... 20x30 cm) en de maat op papier in centimeters
// - Stippellijn voor de veilige marge op het vel
//
// De print gebruikt dezelfde berekening (window.FDPImposeStyle), dus voorbeeld = print.
// Laden NA het inline Impose-script van de pagina.
(function () {
  // ------------------------------------------------------------------
  // Gedeelde berekening: stijl van de afbeelding binnen één vak.
  // cellAspect = breedte / hoogte van het vak.
  function computeStyle(s, cellAspect) {
    const rot = (((Number(s.rotate) || 0) % 360) + 360) % 360;
    const sideways = rot === 90 || rot === 270;
    const aspect = cellAspect > 0 ? cellAspect : 0.707;
    let vw;
    let vh;
    let fit;
    if (s.mode === 'fill') { vw = 100; vh = 100; fit = 'cover'; }
    else if (s.mode === 'free') { vw = s.width; vh = s.height; fit = s.freeFit === 'crop' ? 'cover' : 'fill'; }
    else { vw = s.scale; vh = s.scale; fit = 'contain'; }

    // Bij 90/270 graden draait het element mee; daarom breedte en hoogte omwisselen.
    const cssW = sideways ? vh / aspect : vw;
    const cssH = sideways ? vw * aspect : vh;
    const offX = s.mode === 'fill' ? 0 : (Number(s.offX) || 0);
    const offY = s.mode === 'fill' ? 0 : (Number(s.offY) || 0);
    return {
      position: 'absolute',
      left: round2(50 + offX) + '%',
      top: round2(50 + offY) + '%',
      width: round2(cssW) + '%',
      height: round2(cssH) + '%',
      maxWidth: 'none',
      maxHeight: 'none',
      transform: 'translate(-50%,-50%) rotate(' + rot + 'deg)',
      objectFit: fit,
      objectPosition: fit === 'cover' ? round2(s.cropX) + '% ' + round2(s.cropY) + '%' : '50% 50%'
    };
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  window.FDPImposeStyle = computeStyle;

  // ------------------------------------------------------------------
  const modal = document.getElementById('editLayoutModal');
  const copiesInput = document.getElementById('edit-layout-copies');
  const fitCheckbox = document.getElementById('edit-layout-fit-frame');
  const grid = document.getElementById('edit-layout-grid');
  const sheet = document.getElementById('edit-layout-sheet');
  const paperSelect = document.getElementById('edit-layout-paper-size');
  const orientationSelect = document.getElementById('edit-layout-orientation');
  const mainPreview = document.getElementById('preview-content');
  if (!modal || !copiesInput || !fitCheckbox || !grid || !sheet) return;

  // Direct onder <body>, zodat het venster boven de Handleiding-knop en timer ligt.
  if (modal.parentElement !== document.body) document.body.appendChild(modal);

  const MIN = 5;
  const MAX = 100;
  const SAFE_MARGIN_MM = 5;
  const SNAP = 2.5; // procent: binnen deze afstand klikt de afbeelding vast in het midden
  const PRESETS = {
    full: { cols: 1, rows: 1, tile: 1 }, p10x15: { cols: 1, rows: 2, tile: 1 }, p13x18: { cols: 2, rows: 1, tile: 1 },
    p20x25: { cols: 1, rows: 1, tile: 0.82 }, p9x13: { cols: 2, rows: 2, tile: 1 }, wallet: { cols: 3, rows: 3, tile: 1 }
  };
  const PHOTO_SIZES = [[9, 13], [10, 15], [13, 18], [15, 20], [20, 30]];

  const state = { mode: 'fit', scale: 100, width: 100, height: 100, freeFit: 'stretch', offX: 0, offY: 0, rotate: 0, cropX: 50, cropY: 50 };
  const history = [];
  const ease = 'cubic-bezier(.16,1,.3,1)';

  // ------------------------------------------------------------- stijlen
  const style = document.createElement('style');
  style.textContent = [
    '.fdp-scale{margin-top:1rem;border-radius:.75rem;border:1px solid #93a2b9;background:linear-gradient(180deg,#f3f7fd,#e3ebf7);padding:1rem;',
    'font-family:Manrope,system-ui,sans-serif;color:#1f2937}',
    '.fdp-scale__head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem}',
    '.fdp-scale__title{margin:0;font-size:1.05rem;font-weight:800}',
    '.fdp-scale__seg{display:inline-grid;grid-auto-flow:column;gap:.35rem;background:#dbe4f2;padding:.3rem;border-radius:999px}',
    '.fdp-scale__seg button{border:0;border-radius:999px;padding:.65rem 1.1rem;min-height:48px;font:800 .95rem Manrope,system-ui,sans-serif;',
    'background:transparent;color:#334155;cursor:pointer;transition:background .25s ease,color .25s ease,box-shadow .3s ' + ease + '}',
    '.fdp-scale__seg button.is-active{background:#2563eb;color:#fff;box-shadow:0 8px 18px rgba(37,99,235,.3)}',
    '.fdp-scale__tools{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.8rem}',
    '.fdp-scale__tool{display:inline-flex;align-items:center;gap:.4rem;border:0;border-radius:999px;padding:.6rem 1rem;min-height:48px;',
    'font:800 .9rem Manrope,system-ui,sans-serif;background:#fff;color:#1e3a8a;box-shadow:0 2px 8px rgba(15,23,42,.12);cursor:pointer;',
    'transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .2s ease}',
    '.fdp-scale__tool:active{transform:scale(.94)}',
    '.fdp-scale__tool:disabled{opacity:.4;cursor:default}',
    '.fdp-scale__tool svg{width:18px;height:18px}',
    '.fdp-scale__tool--green{background:#16a34a;color:#fff;box-shadow:0 8px 18px rgba(22,163,74,.28)}',
    '.fdp-scale__row{display:flex;align-items:center;gap:.75rem;margin-top:.9rem}',
    '.fdp-scale__row[hidden]{display:none}',
    '.fdp-scale__label{flex:0 0 7.5rem;font-size:.85rem;font-weight:700;color:#475569}',
    '.fdp-scale__step{flex:none;width:48px;height:48px;border:0;border-radius:999px;background:#fff;color:#1e3a8a;',
    'font:800 1.5rem/1 Manrope,system-ui,sans-serif;box-shadow:0 2px 8px rgba(15,23,42,.12);cursor:pointer}',
    '.fdp-scale__range{flex:1;-webkit-appearance:none;appearance:none;height:10px;border-radius:999px;background:#c7d4e8;outline:none}',
    '.fdp-scale__range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:34px;height:34px;border-radius:50%;background:#2563eb;',
    'border:4px solid #fff;box-shadow:0 4px 12px rgba(37,99,235,.4);cursor:pointer}',
    '.fdp-scale__range::-moz-range-thumb{width:28px;height:28px;border-radius:50%;background:#2563eb;border:4px solid #fff}',
    '.fdp-scale__value{flex:0 0 3.6rem;text-align:right;font:800 1.05rem Manrope,system-ui,sans-serif;font-variant-numeric:tabular-nums}',
    '.fdp-scale__photos{display:flex;flex-wrap:wrap;gap:.4rem}',
    '.fdp-scale__photo{border:2px solid #c7d4e8;border-radius:.7rem;background:#fff;min-height:48px;padding:.45rem .8rem;',
    'font:800 .9rem Manrope,system-ui,sans-serif;color:#1f2937;cursor:pointer;font-variant-numeric:tabular-nums}',
    '.fdp-scale__photo.is-active{border-color:#2563eb;background:#eff6ff;color:#1d4ed8}',
    '.fdp-scale__photo:disabled{opacity:.35;cursor:default}',
    '.fdp-scale__info{margin:.8rem 0 0;font-size:.95rem;font-weight:700;color:#1f2937}',
    '.fdp-scale__info strong{font-size:1.1rem;font-variant-numeric:tabular-nums}',
    '.fdp-scale__hint{margin:.4rem 0 0;font-size:.8rem;color:#64748b}',
    'label:has(> #edit-layout-fit-frame){display:none !important}',

    // afbeelding in het voorbeeld: vloeiend, behalve tijdens het slepen
    '#edit-layout-grid img,#preview-content img{transition:width .3s ' + ease + ',height .3s ' + ease + ',left .3s ' + ease + ',top .3s ' + ease + ',transform .45s ' + ease + '}',
    '#edit-layout-grid img{touch-action:none;cursor:grab;-webkit-user-drag:none;user-select:none}',
    '#edit-layout-grid{touch-action:none}',
    '.fdp-gesture #edit-layout-grid img,.fdp-gesture .fdp-select{transition:none !important;animation:none !important}',
    '.fdp-gesture #edit-layout-grid img{cursor:grabbing}',

    // selectiekader en grepen
    '.fdp-select{position:absolute;z-index:5;transform:translate(-50%,-50%);outline:2px dashed #2563eb;outline-offset:-1px;pointer-events:none;',
    'transition:left .3s ' + ease + ',top .3s ' + ease + ',width .3s ' + ease + ',height .3s ' + ease + ';animation:fdpSelectIn .25s ' + ease + '}',
    '@keyframes fdpSelectIn{from{opacity:0}to{opacity:1}}',
    '.fdp-handle{position:absolute;width:44px;height:44px;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center}',
    '.fdp-handle::after{content:"";width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.35);',
    'transition:transform .2s ' + ease + '}',
    '.fdp-handle.is-dragging::after{transform:scale(1.35)}',
    '.fdp-handle[data-h="nw"],.fdp-handle[data-h="se"]{cursor:nwse-resize}.fdp-handle[data-h="ne"],.fdp-handle[data-h="sw"]{cursor:nesw-resize}',
    '.fdp-handle[data-h="n"],.fdp-handle[data-h="s"]{cursor:ns-resize}.fdp-handle[data-h="e"],.fdp-handle[data-h="w"]{cursor:ew-resize}',
    '.fdp-size-badge{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:6;background:rgba(15,23,42,.85);color:#fff;',
    'font:800 .8rem Manrope,system-ui,sans-serif;padding:.25rem .6rem;border-radius:999px;pointer-events:none;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.fdp-guide-line{position:absolute;z-index:4;background:#ec4899;pointer-events:none;opacity:0;transition:opacity .15s ease}',
    '.fdp-guide-line.is-on{opacity:.9}',
    '.fdp-guide-line--v{top:0;bottom:0;left:50%;width:1px}.fdp-guide-line--h{left:0;right:0;top:50%;height:1px}',

    // veilige marge op het vel
    '.fdp-safe{position:absolute;z-index:3;border:1.5px dashed rgba(234,88,12,.85);border-radius:2px;pointer-events:none}',
    '.fdp-safe__label{position:absolute;right:4px;top:-1px;transform:translateY(-100%);font:700 10px/1.4 Manrope,system-ui,sans-serif;',
    'color:#c2410c;background:rgba(255,255,255,.85);padding:0 4px;border-radius:3px;white-space:nowrap}'
  ].join('');
  document.head.appendChild(style);

  // ---------------------------------------------------------- het paneel
  const icons = {
    rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    center: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>'
  };

  const panel = document.createElement('div');
  panel.className = 'fdp-scale';
  panel.innerHTML = '<div class="fdp-scale__head">'
    + '<p class="fdp-scale__title">Grootte afbeelding / Image size</p>'
    + '<div class="fdp-scale__seg" data-group="mode" role="group" aria-label="Schaalmodus">'
    + '<button type="button" data-mode="fit">Passend</button>'
    + '<button type="button" data-mode="fill">Vullen</button>'
    + '<button type="button" data-mode="free">Vrij formaat</button>'
    + '</div></div>'
    + '<div class="fdp-scale__tools">'
    + '<button type="button" class="fdp-scale__tool" data-tool="rotate">' + icons.rotate + 'Draai 90°</button>'
    + '<button type="button" class="fdp-scale__tool" data-tool="center">' + icons.center + 'Centreren</button>'
    + '<button type="button" class="fdp-scale__tool" data-tool="undo">' + icons.undo + 'Ongedaan maken</button>'
    + '<button type="button" class="fdp-scale__tool fdp-scale__tool--green" data-tool="fit">Passend maken</button>'
    + '</div>'
    + row('scale', 'Grootte')
    + row('width', 'Breedte')
    + row('height', 'Hoogte')
    + '<div class="fdp-scale__row" data-row="freefit"><span class="fdp-scale__label">In het kader</span>'
    + '<div class="fdp-scale__seg" data-group="freefit"><button type="button" data-freefit="stretch">Uitrekken</button>'
    + '<button type="button" data-freefit="crop">Bijsnijden</button></div></div>'
    + '<div class="fdp-scale__row" data-row="photos"><span class="fdp-scale__label">Fotoformaat</span>'
    + '<div class="fdp-scale__photos">' + PHOTO_SIZES.map(function (p) {
      return '<button type="button" class="fdp-scale__photo" data-photo="' + p[0] + 'x' + p[1] + '">' + p[0] + '×' + p[1] + ' cm</button>';
    }).join('') + '</div></div>'
    + '<p class="fdp-scale__info">Op papier: <strong data-info="size"></strong></p>'
    + '<p class="fdp-scale__hint"></p>';

  function row(key, label) {
    return '<div class="fdp-scale__row" data-row="' + key + '">'
      + '<span class="fdp-scale__label">' + label + '</span>'
      + '<button type="button" class="fdp-scale__step" data-step="-5" data-key="' + key + '" aria-label="' + label + ' kleiner">−</button>'
      + '<input type="range" class="fdp-scale__range" min="' + MIN + '" max="' + MAX + '" step="1" data-key="' + key + '" aria-label="' + label + '">'
      + '<button type="button" class="fdp-scale__step" data-step="5" data-key="' + key + '" aria-label="' + label + ' groter">+</button>'
      + '<span class="fdp-scale__value" data-value="' + key + '"></span>'
      + '</div>';
  }

  // Boven het voorbeeldvel plaatsen.
  const sheetArea = sheet.closest('.mt-4');
  if (sheetArea && sheetArea.parentNode) sheetArea.parentNode.insertBefore(panel, sheetArea);
  else modal.querySelector('.modal-content').appendChild(panel);

  const hints = {
    fit: 'Tik op de afbeelding: sleep om te verplaatsen, trek aan een hoek of knijp met twee vingers om groter of kleiner te maken.',
    fill: 'De afbeelding vult het hele kader. Sleep de afbeelding om te kiezen welk deel zichtbaar blijft.',
    free: 'Tik op de afbeelding en trek aan de bolletjes om breedte en hoogte los aan te passen. Uitrekken kan de afbeelding vervormen.'
  };

  // ---------------------------------------------------- maten op papier
  function currentSettings() { return window.FDPImpositionSettings || {}; }

  function sheetMm() {
    const s = currentSettings();
    const a3 = (paperSelect ? paperSelect.value : s.paperSize) === 'A3';
    const landscape = (orientationSelect ? orientationSelect.value : s.orientation) === 'landscape';
    const shortMm = a3 ? 297 : 210;
    const longMm = a3 ? 420 : 297;
    return landscape ? { w: longMm, h: shortMm } : { w: shortMm, h: longMm };
  }

  // Afmeting van één vak in mm, zoals in de print (6 mm rand, 2,5 mm tussenruimte).
  function cellMm() {
    const p = PRESETS[currentSettings().presetId] || PRESETS.full;
    const sh = sheetMm();
    const w = ((sh.w - 12) - 2.5 * (p.cols - 1)) / p.cols * p.tile;
    const h = ((sh.h - 12) - 2.5 * (p.rows - 1)) / p.rows * p.tile;
    return { w: w, h: h };
  }

  function imageAspect() {
    const img = grid.querySelector('img');
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    let a = img.naturalWidth / img.naturalHeight;
    if (state.rotate === 90 || state.rotate === 270) a = 1 / a;
    return a;
  }

  // Zichtbare grootte van de afbeelding in % van het vak.
  function visualPct(cellAspect) {
    if (state.mode === 'fill') return { w: 100, h: 100 };
    if (state.mode === 'free') return { w: state.width, h: state.height };
    const ia = imageAspect();
    if (!ia) return { w: state.scale, h: state.scale };
    if (ia > cellAspect) return { w: state.scale, h: state.scale * cellAspect / ia };
    return { w: state.scale * ia / cellAspect, h: state.scale };
  }

  function cm(mm) { return (Math.round(mm) / 10).toFixed(1).replace('.', ','); }

  function sizeText() {
    const c = cellMm();
    const v = visualPct(c.w / c.h);
    return cm(v.w / 100 * c.w) + ' × ' + cm(v.h / 100 * c.h) + ' cm';
  }

  // ------------------------------------------------- toepassen op beelden
  function cellAspectOf(img) {
    const r = img.parentElement ? img.parentElement.getBoundingClientRect() : null;
    if (r && r.width > 0 && r.height > 0) return r.width / r.height;
    const c = cellMm();
    return c.w / c.h;
  }

  function applyToImages(container) {
    if (!container) return;
    container.querySelectorAll('img').forEach(function (img) {
      const css = computeStyle(state, cellAspectOf(img));
      Object.keys(css).forEach(function (k) { img.style[k] = css[k]; });
      img.classList.remove('object-cover', 'object-contain');
      img.draggable = false;
      if (!img.dataset.fdpLoadHook) {
        img.dataset.fdpLoadHook = '1';
        img.addEventListener('load', function () { render(); drawSelection(); });
      }
    });
  }

  function applyEverywhere() {
    applyToImages(grid);
    applyToImages(mainPreview);
  }

  // De print-instellingen van de pagina aanvullen met onze keuze.
  let settings = window.FDPImpositionSettings;
  function withScale(target) {
    if (!target || typeof target !== 'object') return target;
    target.impose = JSON.parse(JSON.stringify(state));
    target.scaleMode = state.mode;
    target.scalePct = state.scale;
    target.freeWidthPct = state.width;
    target.freeHeightPct = state.height;
    target.fitToFrame = state.mode === 'fill';
    return target;
  }
  Object.defineProperty(window, 'FDPImpositionSettings', {
    configurable: true,
    get: function () { return settings; },
    set: function (value) { settings = withScale(value); }
  });
  withScale(settings);

  // ------------------------------------------------------------- weergave
  function render() {
    panel.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-mode') === state.mode); });
    panel.querySelectorAll('[data-freefit]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-freefit') === state.freeFit); });
    panel.querySelector('[data-row="scale"]').hidden = state.mode !== 'fit';
    panel.querySelector('[data-row="width"]').hidden = state.mode !== 'free';
    panel.querySelector('[data-row="height"]').hidden = state.mode !== 'free';
    panel.querySelector('[data-row="freefit"]').hidden = state.mode !== 'free';
    ['scale', 'width', 'height'].forEach(function (key) {
      panel.querySelector('input[data-key="' + key + '"]').value = Math.round(state[key]);
      panel.querySelector('[data-value="' + key + '"]').textContent = Math.round(state[key]) + '%';
    });
    panel.querySelector('[data-tool="undo"]').disabled = history.length === 0;
    panel.querySelector('[data-tool="center"]').disabled = state.mode === 'fill' ? (state.cropX === 50 && state.cropY === 50) : (state.offX === 0 && state.offY === 0);

    const c = cellMm();
    const ia = imageAspect();
    panel.querySelectorAll('[data-photo]').forEach(function (b) {
      const dims = photoPct(b.getAttribute('data-photo'), ia);
      const turned = photoPct(b.getAttribute('data-photo'), ia ? 1 / ia : null, true);
      b.disabled = !dims.fits && !turned.fits;
      b.title = dims.fits ? '' : (turned.fits ? 'Past als de foto een kwartslag draait' : 'Past niet op dit formaat papier');
      b.classList.toggle('is-active', state.mode === 'free' && state.freeFit === 'crop'
        && Math.abs(state.width - dims.w) < 0.6 && Math.abs(state.height - dims.h) < 0.6);
    });
    panel.querySelector('[data-info="size"]').textContent = sizeText() + '  (vak ' + cm(c.w) + ' × ' + cm(c.h) + ' cm)';
    panel.querySelector('.fdp-scale__hint').textContent = hints[state.mode];
    updateSelectionBox();
  }

  // Fotoformaat -> breedte/hoogte in % van het vak, staand of liggend zoals de foto.
  function photoPct(key, ia, flipDefault) {
    const parts = key.split('x').map(Number);
    const c = cellMm();
    const landscape = ia ? ia >= 1 : (flipDefault ? c.w < c.h : c.w >= c.h);
    const wmm = (landscape ? Math.max(parts[0], parts[1]) : Math.min(parts[0], parts[1])) * 10;
    const hmm = (landscape ? Math.min(parts[0], parts[1]) : Math.max(parts[0], parts[1])) * 10;
    const w = wmm / c.w * 100;
    const h = hmm / c.h * 100;
    return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10, fits: w <= MAX + 0.01 && h <= MAX + 0.01 };
  }

  function changed() {
    const wantFill = state.mode === 'fill';
    if (fitCheckbox.checked !== wantFill) {
      fitCheckbox.checked = wantFill;
      fitCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    withScale(settings);
    applyEverywhere();
    render();
    drawSelection();
    drawSafeMargin();
  }

  // ------------------------------------------------------- ongedaan maken
  function snapshot() { return JSON.stringify(state); }
  function pushHistory() {
    const snap = snapshot();
    if (history[history.length - 1] !== snap) history.push(snap);
    if (history.length > 50) history.shift();
  }
  function undo() {
    if (!history.length) return;
    Object.assign(state, JSON.parse(history.pop()));
    changed();
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function clampPct(v) { return Math.round(clamp(v, MIN, MAX) * 10) / 10; }

  // ------------------------------------------------------------ knoppen
  panel.addEventListener('click', function (event) {
    const modeBtn = event.target.closest('[data-mode]');
    if (modeBtn) {
      if (modeBtn.getAttribute('data-mode') !== state.mode) { pushHistory(); state.mode = modeBtn.getAttribute('data-mode'); changed(); }
      return;
    }
    const ffBtn = event.target.closest('[data-freefit]');
    if (ffBtn) { pushHistory(); state.freeFit = ffBtn.getAttribute('data-freefit'); changed(); return; }
    const stepBtn = event.target.closest('.fdp-scale__step');
    if (stepBtn) {
      pushHistory();
      const key = stepBtn.getAttribute('data-key');
      state[key] = clampPct(state[key] + Number(stepBtn.getAttribute('data-step')));
      changed();
      return;
    }
    const photoBtn = event.target.closest('[data-photo]');
    if (photoBtn && !photoBtn.disabled) {
      pushHistory();
      let dims = photoPct(photoBtn.getAttribute('data-photo'), imageAspect());
      if (!dims.fits) {
        // Past alleen gedraaid: foto een kwartslag draaien, zoals een fotokiosk doet.
        state.rotate = (state.rotate + 90) % 360;
        dims = photoPct(photoBtn.getAttribute('data-photo'), imageAspect());
      }
      state.mode = 'free'; state.freeFit = 'crop'; state.width = dims.w; state.height = dims.h;
      state.offX = 0; state.offY = 0;
      state.cropX = 50; state.cropY = 50;
      changed();
      return;
    }
    const tool = event.target.closest('[data-tool]');
    if (!tool || tool.disabled) return;
    const name = tool.getAttribute('data-tool');
    if (name === 'undo') { undo(); return; }
    pushHistory();
    if (name === 'rotate') {
      state.rotate = (state.rotate + 90) % 360;
      if (state.mode === 'free') { const w = state.width; state.width = state.height; state.height = w; }
    } else if (name === 'center') {
      state.offX = 0; state.offY = 0; state.cropX = 50; state.cropY = 50;
    } else if (name === 'fit') {
      Object.assign(state, { mode: 'fit', scale: 100, width: 100, height: 100, freeFit: 'stretch', offX: 0, offY: 0, cropX: 50, cropY: 50 });
    }
    changed();
  });

  let sliderHistoryPushed = false;
  panel.addEventListener('input', function (event) {
    const range = event.target.closest('.fdp-scale__range');
    if (!range) return;
    if (!sliderHistoryPushed) { pushHistory(); sliderHistoryPushed = true; }
    state[range.getAttribute('data-key')] = clampPct(Number(range.value));
    changed();
  });
  panel.addEventListener('change', function () { sliderHistoryPushed = false; });

  // ------------------------------------------------ selectie en grepen
  let selectedIndex = -1;
  const handleDirs = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
  const handlePos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };

  function gridImages() { return Array.from(grid.querySelectorAll('img')); }
  function selectedImage() { return gridImages()[selectedIndex] || null; }

  function removeSelection() {
    grid.querySelectorAll('.fdp-own').forEach(function (el) { el.remove(); });
  }

  function drawSelection() {
    removeSelection();
    const img = selectedImage();
    if (!img) return;
    const cell = img.parentElement;
    const box = document.createElement('div');
    box.className = 'fdp-select fdp-own';
    const keys = state.mode === 'free' ? Object.keys(handlePos) : (state.mode === 'fit' ? ['nw', 'ne', 'se', 'sw'] : []);
    keys.forEach(function (key) {
      const h = document.createElement('div');
      h.className = 'fdp-handle';
      h.setAttribute('data-h', key);
      // Grepen binnen het kader houden, zodat ze aan de rand van het vel aan te tikken zijn.
      h.style.left = 'calc(' + handlePos[key][0] + '% - ' + (handlePos[key][0] / 100 * 44) + 'px)';
      h.style.top = 'calc(' + handlePos[key][1] + '% - ' + (handlePos[key][1] / 100 * 44) + 'px)';
      box.appendChild(h);
    });
    const badge = document.createElement('div');
    badge.className = 'fdp-size-badge fdp-own';
    const vLine = document.createElement('div');
    vLine.className = 'fdp-guide-line fdp-guide-line--v fdp-own';
    const hLine = document.createElement('div');
    hLine.className = 'fdp-guide-line fdp-guide-line--h fdp-own';
    cell.appendChild(vLine);
    cell.appendChild(hLine);
    cell.appendChild(box);
    cell.appendChild(badge);
    updateSelectionBox();
  }

  function updateSelectionBox() {
    const img = selectedImage();
    const box = grid.querySelector('.fdp-select');
    if (!img || !box) return;
    const v = visualPct(cellAspectOf(img));
    const offX = state.mode === 'fill' ? 0 : state.offX;
    const offY = state.mode === 'fill' ? 0 : state.offY;
    box.style.left = (50 + offX) + '%';
    box.style.top = (50 + offY) + '%';
    box.style.width = v.w + '%';
    box.style.height = v.h + '%';
    const badge = grid.querySelector('.fdp-size-badge');
    if (badge) badge.textContent = sizeText();
  }

  function showGuides(onX, onY) {
    const v = grid.querySelector('.fdp-guide-line--v');
    const h = grid.querySelector('.fdp-guide-line--h');
    if (v) v.classList.toggle('is-on', !!onX);
    if (h) h.classList.toggle('is-on', !!onY);
  }

  // ---------------------------------------------------------- gebaren
  // Eén vinger op de afbeelding = verplaatsen (in Vullen: uitsnede kiezen),
  // greep = formaat, twee vingers = knijpen.
  const pointers = new Map();
  let gesture = null;

  function cellRectOf(img) { return img.parentElement.getBoundingClientRect(); }

  function startGesture(kind, data) {
    pushHistory();
    gesture = Object.assign({ kind: kind }, data);
    modal.classList.add('fdp-gesture');
  }

  function endGesture() {
    if (!gesture) return;
    if (gesture.handle) gesture.handle.classList.remove('is-dragging');
    gesture = null;
    modal.classList.remove('fdp-gesture');
    showGuides(false, false);
    // Geen echte wijziging (bijv. alleen een tik)? Dan ook geen stap in "ongedaan maken".
    if (history.length && history[history.length - 1] === snapshot()) history.pop();
    changed();
  }

  function liveUpdate() {
    applyToImages(grid);
    updateSelectionBox();
    withScale(settings);
    render();
  }

  grid.addEventListener('pointerdown', function (event) {
    const handle = event.target.closest('.fdp-handle');
    const img = event.target.closest('img');
    if (!handle && !img) { selectedIndex = -1; removeSelection(); return; }
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { grid.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }

    if (img) {
      const index = gridImages().indexOf(img);
      if (index !== selectedIndex) { selectedIndex = index; drawSelection(); }
    }
    const target = selectedImage();
    if (!target) return;
    const cell = cellRectOf(target);

    // Twee vingers: knijpen.
    if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      if (gesture) { gesture.handle && gesture.handle.classList.remove('is-dragging'); gesture = null; modal.classList.remove('fdp-gesture'); }
      if (state.mode === 'fill') return;
      startGesture('pinch', {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        scale: state.scale, width: state.width, height: state.height
      });
      return;
    }
    if (pointers.size > 2) return;

    if (handle) {
      handle.classList.add('is-dragging');
      const v = visualPct(cell.width / cell.height);
      startGesture('resize', {
        handle: handle, dir: handleDirs[handle.getAttribute('data-h')], x: event.clientX, y: event.clientY,
        cellW: cell.width, cellH: cell.height, scale: state.scale, width: state.width, height: state.height,
        halfW: v.w / 100 * cell.width / 2, halfH: v.h / 100 * cell.height / 2
      });
      return;
    }

    if (state.mode === 'fill') {
      startGesture('pan', { x: event.clientX, y: event.clientY, cropX: state.cropX, cropY: state.cropY, img: target, cellW: cell.width, cellH: cell.height });
    } else {
      startGesture('move', { x: event.clientX, y: event.clientY, offX: state.offX, offY: state.offY, cellW: cell.width, cellH: cell.height });
    }
  });

  grid.addEventListener('pointermove', function (event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    const g = gesture;

    if (g.kind === 'pinch' && pointers.size >= 2) {
      const pts = Array.from(pointers.values());
      const ratio = (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1) / g.dist;
      if (state.mode === 'fit') state.scale = clampPct(g.scale * ratio);
      if (state.mode === 'free') { state.width = clampPct(g.width * ratio); state.height = clampPct(g.height * ratio); }
    } else if (g.kind === 'resize') {
      const dx = (event.clientX - g.x) * g.dir[0];
      const dy = (event.clientY - g.y) * g.dir[1];
      if (state.mode === 'free') {
        // Het midden blijft staan: 10 px naar buiten = aan beide kanten 10 px groter.
        if (g.dir[0]) state.width = clampPct(g.width + (2 * dx / g.cellW) * 100);
        if (g.dir[1]) state.height = clampPct(g.height + (2 * dy / g.cellH) * 100);
      } else if (state.mode === 'fit') {
        // Hoek: in verhouding groter/kleiner.
        const rx = (g.halfW + dx) / g.halfW;
        const ry = (g.halfH + dy) / g.halfH;
        state.scale = clampPct(g.scale * (rx + ry) / 2);
      }
    } else if (g.kind === 'move') {
      let offX = g.offX + (event.clientX - g.x) / g.cellW * 100;
      let offY = g.offY + (event.clientY - g.y) / g.cellH * 100;
      const snapX = Math.abs(offX) < SNAP;
      const snapY = Math.abs(offY) < SNAP;
      if (snapX) offX = 0;
      if (snapY) offY = 0;
      state.offX = Math.round(clamp(offX, -50, 50) * 10) / 10;
      state.offY = Math.round(clamp(offY, -50, 50) * 10) / 10;
      showGuides(snapX, snapY);
    } else if (g.kind === 'pan') {
      // Schermbeweging omrekenen naar de (eventueel gedraaide) afbeelding.
      const t = state.rotate * Math.PI / 180;
      const sx = event.clientX - g.x;
      const sy = event.clientY - g.y;
      const lx = sx * Math.cos(t) + sy * Math.sin(t);
      const ly = -sx * Math.sin(t) + sy * Math.cos(t);
      const sideways = state.rotate === 90 || state.rotate === 270;
      const boxW = sideways ? g.cellH : g.cellW;
      const boxH = sideways ? g.cellW : g.cellH;
      const nw = g.img.naturalWidth || boxW;
      const nh = g.img.naturalHeight || boxH;
      const k = Math.max(boxW / nw, boxH / nh);
      const overX = nw * k - boxW;
      const overY = nh * k - boxH;
      if (overX > 1) state.cropX = Math.round(clamp(g.cropX - lx / overX * 100, 0, 100));
      if (overY > 1) state.cropY = Math.round(clamp(g.cropY - ly / overY * 100, 0, 100));
    }
    liveUpdate();
  });

  function pointerEnd(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (gesture && (gesture.kind !== 'pinch' || pointers.size < 2)) endGesture();
  }
  grid.addEventListener('pointerup', pointerEnd);
  grid.addEventListener('pointercancel', pointerEnd);
  grid.addEventListener('lostpointercapture', pointerEnd);
  window.addEventListener('blur', function () { pointers.clear(); endGesture(); });

  // ------------------------------------------------------- veilige marge
  function drawSafeMargin() {
    let box = sheet.querySelector('.fdp-safe');
    if (!box) {
      box = document.createElement('div');
      box.className = 'fdp-safe';
      box.innerHTML = '<span class="fdp-safe__label">Veilige marge ' + SAFE_MARGIN_MM + ' mm</span>';
      sheet.appendChild(box);
    }
    const r = sheet.getBoundingClientRect();
    const mm = sheetMm();
    const px = r.width > 0 ? SAFE_MARGIN_MM / mm.w * r.width : 0;
    box.style.left = box.style.right = px + 'px';
    const pxH = r.height > 0 ? SAFE_MARGIN_MM / mm.h * r.height : 0;
    box.style.top = box.style.bottom = pxH + 'px';
    box.title = 'Binnen deze lijn wordt geprint; de printer kan niet tot aan de rand printen.';
  }

  [paperSelect, orientationSelect].forEach(function (el) {
    if (el) el.addEventListener('change', function () { setTimeout(changed, 260); });
  });
  new MutationObserver(function () { setTimeout(function () { drawSafeMargin(); render(); }, 260); })
    .observe(sheet, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(function () {
    if (modal.classList.contains('is-open')) setTimeout(function () { applyEverywhere(); render(); drawSelection(); drawSafeMargin(); }, 60);
  }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', function () { drawSafeMargin(); updateSelectionBox(); });

  // ---------------------------------- opnieuw getekend voorbeeld bijwerken
  [grid, mainPreview].forEach(function (container) {
    if (!container) return;
    new MutationObserver(function (mutations) {
      if (gesture) return;
      const external = mutations.some(function (m) {
        if (m.target.nodeType === 1 && m.target.closest('.fdp-own')) return false;
        return Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).some(function (n) {
          return n.nodeType === 1 && !n.classList.contains('fdp-own') && !n.closest('.fdp-own');
        });
      });
      if (!external) return;
      applyToImages(container);
      if (container === grid) {
        if (!grid.querySelector('img')) selectedIndex = -1;
        drawSelection();
        render();
      }
    }).observe(container, { childList: true, subtree: true });
  });

  // Start in dezelfde stand als het oude vinkje (standaard aan = Vullen),
  // zodat de standaardprint niet verandert.
  state.mode = fitCheckbox.checked ? 'fill' : 'fit';
  changed();
})();
