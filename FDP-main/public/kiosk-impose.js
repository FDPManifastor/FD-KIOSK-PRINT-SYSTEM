// Schaalopties in het Impose-venster (nu alleen TEST COPY 1):
// - Passend: hele afbeelding in verhouding, met grootte 5-100% van het kader
// - Vullen: kader helemaal vullen (bijsnijden) - het oude vinkje "Fit picture to frame"
// - Vrij formaat: breedte en hoogte los instellen (mag uit verhouding)
// - Knop "Passend maken" zet alles terug op passend 100%
// De keuze gaat mee naar de print via window.FDPImpositionSettings.
// Laden NA het inline Impose-script van de pagina.
(function () {
  const modal = document.getElementById('editLayoutModal');
  const copiesInput = document.getElementById('edit-layout-copies');
  const fitCheckbox = document.getElementById('edit-layout-fit-frame');
  const grid = document.getElementById('edit-layout-grid');
  const mainPreview = document.getElementById('preview-content');
  if (!modal || !copiesInput || !fitCheckbox || !grid) return;

  // Het venster zit in een container die het onder de Handleiding-knop en timer houdt;
  // direct onder <body> ligt het er altijd bovenop.
  if (modal.parentElement !== document.body) document.body.appendChild(modal);

  const state = { mode: 'fit', scale: 100, width: 100, height: 100 };
  const ease = 'cubic-bezier(.16,1,.3,1)';

  const style = document.createElement('style');
  style.textContent = [
    '.fdp-scale{margin-top:1rem;border-radius:.75rem;border:1px solid #93a2b9;background:linear-gradient(180deg,#f3f7fd,#e3ebf7);padding:1rem;',
    'font-family:Manrope,system-ui,sans-serif;color:#1f2937}',
    '.fdp-scale__head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem}',
    '.fdp-scale__title{margin:0;font-size:1.05rem;font-weight:800}',
    '.fdp-scale__modes{display:inline-grid;grid-template-columns:repeat(3,auto);gap:.4rem;background:#dbe4f2;padding:.3rem;border-radius:999px}',
    '.fdp-scale__mode{border:0;border-radius:999px;padding:.7rem 1.15rem;min-height:48px;font:800 .95rem Manrope,system-ui,sans-serif;',
    'background:transparent;color:#334155;cursor:pointer;transition:background .25s ease,color .25s ease,box-shadow .3s ' + ease + '}',
    '.fdp-scale__mode.is-active{background:#2563eb;color:#fff;box-shadow:0 8px 18px rgba(37,99,235,.3)}',
    '.fdp-scale__fit{border:0;border-radius:999px;padding:.7rem 1.2rem;min-height:48px;font:800 .95rem Manrope,system-ui,sans-serif;',
    'background:#16a34a;color:#fff;cursor:pointer;box-shadow:0 8px 18px rgba(22,163,74,.28)}',
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
    '.fdp-scale__hint{margin:.6rem 0 0;font-size:.8rem;color:#64748b}',
    // vloeiende overgang van de afbeelding in het voorbeeld
    '#edit-layout-grid img,#preview-content img{transition:width .3s ' + ease + ',height .3s ' + ease + '}',
    'label:has(> #edit-layout-fit-frame){display:none !important}',
    // Selectiekader met grepen voor Vrij formaat
    '.fdp-free-img{cursor:pointer}',
    '.fdp-select{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;outline:2px dashed #2563eb;outline-offset:-1px;',
    'touch-action:none;pointer-events:none;animation:fdpSelectIn .25s ' + ease + '}',
    '@keyframes fdpSelectIn{from{opacity:0;transform:translate(-50%,-50%) scale(.96)}to{opacity:1;transform:translate(-50%,-50%)}}',
    '.fdp-handle{position:absolute;width:44px;height:44px;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center}',
    '.fdp-handle::after{content:"";width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.35);',
    'transition:transform .2s ' + ease + '}',
    '.fdp-handle:active::after,.fdp-handle.is-dragging::after{transform:scale(1.35)}',
    '.fdp-handle[data-h="nw"],.fdp-handle[data-h="se"]{cursor:nwse-resize}.fdp-handle[data-h="ne"],.fdp-handle[data-h="sw"]{cursor:nesw-resize}',
    '.fdp-handle[data-h="n"],.fdp-handle[data-h="s"]{cursor:ns-resize}.fdp-handle[data-h="e"],.fdp-handle[data-h="w"]{cursor:ew-resize}',
    '.fdp-dragging #edit-layout-grid img,.fdp-dragging .fdp-select{transition:none !important;animation:none}',
    '.fdp-size-badge{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);z-index:6;background:rgba(15,23,42,.85);color:#fff;',
    'font:800 .8rem Manrope,system-ui,sans-serif;padding:.25rem .6rem;border-radius:999px;pointer-events:none;white-space:nowrap}'
  ].join('');
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.className = 'fdp-scale';
  panel.innerHTML = '<div class="fdp-scale__head">'
    + '<p class="fdp-scale__title">Grootte afbeelding / Image size</p>'
    + '<div class="fdp-scale__modes" role="group" aria-label="Schaalmodus">'
    + '<button type="button" class="fdp-scale__mode" data-mode="fit">Passend</button>'
    + '<button type="button" class="fdp-scale__mode" data-mode="fill">Vullen</button>'
    + '<button type="button" class="fdp-scale__mode" data-mode="free">Vrij formaat</button>'
    + '</div>'
    + '<button type="button" class="fdp-scale__fit">Passend maken</button>'
    + '</div>'
    + row('scale', 'Grootte')
    + row('width', 'Breedte')
    + row('height', 'Hoogte')
    + '<p class="fdp-scale__hint"></p>';

  function row(key, label) {
    return '<div class="fdp-scale__row" data-row="' + key + '">'
      + '<span class="fdp-scale__label">' + label + '</span>'
      + '<button type="button" class="fdp-scale__step" data-step="-5" data-key="' + key + '" aria-label="' + label + ' kleiner">−</button>'
      + '<input type="range" class="fdp-scale__range" min="5" max="100" step="1" data-key="' + key + '" aria-label="' + label + '">'
      + '<button type="button" class="fdp-scale__step" data-step="5" data-key="' + key + '" aria-label="' + label + ' groter">+</button>'
      + '<span class="fdp-scale__value" data-value="' + key + '"></span>'
      + '</div>';
  }

  // Boven het voorbeeldvel plaatsen (zodat de keuze direct boven het kader staat).
  const sheetEl = document.getElementById('edit-layout-sheet');
  const sheetArea = sheetEl ? sheetEl.closest('.mt-4') : null;
  if (sheetArea && sheetArea.parentNode) sheetArea.parentNode.insertBefore(panel, sheetArea);
  else modal.querySelector('.modal-content').appendChild(panel);

  const hints = {
    fit: 'De hele afbeelding blijft in verhouding zichtbaar. Maak hem kleiner met de schuif of −.',
    fill: 'De afbeelding vult het hele kader; wat buiten het kader valt wordt bijgesneden.',
    free: 'Tik op de afbeelding in het kader en sleep aan de blauwe bolletjes, of gebruik de schuiven. Let op: de afbeelding kan hierdoor uitgerekt worden.'
  };

  // ---------------------------------------------------- afbeelding stylen
  function imageStyle() {
    if (state.mode === 'fill') return { position: '', left: '', top: '', transform: '', width: '100%', height: '100%', objectFit: 'cover' };
    const w = state.mode === 'free' ? state.width : state.scale;
    const h = state.mode === 'free' ? state.height : state.scale;
    return {
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
      width: w + '%', height: h + '%', objectFit: state.mode === 'free' ? 'fill' : 'contain'
    };
  }

  function applyToImages(container) {
    if (!container) return;
    const css = imageStyle();
    container.querySelectorAll('img').forEach(function (img) {
      Object.keys(css).forEach(function (k) { img.style[k] = css[k]; });
      img.classList.remove('object-cover', 'object-contain');
    });
  }

  function applyEverywhere() {
    applyToImages(grid);
    applyToImages(mainPreview);
  }

  // Elke keer dat de pagina de instellingen opnieuw maakt, onze velden toevoegen.
  let settings = window.FDPImpositionSettings;
  function withScale(target) {
    if (!target || typeof target !== 'object') return target;
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

  // ------------------------------------------------------------ bediening
  function render() {
    panel.querySelectorAll('.fdp-scale__mode').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-mode') === state.mode);
    });
    panel.querySelector('[data-row="scale"]').hidden = state.mode !== 'fit';
    panel.querySelector('[data-row="width"]').hidden = state.mode !== 'free';
    panel.querySelector('[data-row="height"]').hidden = state.mode !== 'free';
    ['scale', 'width', 'height'].forEach(function (key) {
      panel.querySelector('input[data-key="' + key + '"]').value = state[key];
      panel.querySelector('[data-value="' + key + '"]').textContent = state[key] + '%';
    });
    panel.querySelector('.fdp-scale__hint').textContent = hints[state.mode];
  }

  function changed() {
    if (state.mode !== 'free') selectedIndex = -1;
    // Het oude vinkje bijhouden zodat het bestaande voorbeeld klopt.
    const wantFill = state.mode === 'fill';
    if (fitCheckbox.checked !== wantFill) {
      fitCheckbox.checked = wantFill;
      fitCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    withScale(settings);
    render();
    applyEverywhere();
    if (typeof drawSelection === 'function') drawSelection();
  }

  function setValue(key, value) {
    state[key] = Math.max(5, Math.min(100, Math.round(value)));
    changed();
  }

  panel.addEventListener('click', function (event) {
    const modeBtn = event.target.closest('.fdp-scale__mode');
    if (modeBtn) { state.mode = modeBtn.getAttribute('data-mode'); changed(); return; }
    const stepBtn = event.target.closest('.fdp-scale__step');
    if (stepBtn) {
      const key = stepBtn.getAttribute('data-key');
      setValue(key, state[key] + Number(stepBtn.getAttribute('data-step')));
      return;
    }
    if (event.target.closest('.fdp-scale__fit')) {
      state.mode = 'fit'; state.scale = 100; state.width = 100; state.height = 100;
      changed();
    }
  });
  panel.addEventListener('input', function (event) {
    const range = event.target.closest('.fdp-scale__range');
    if (range) setValue(range.getAttribute('data-key'), Number(range.value));
  });

  // ------------------------------------------- handmatig formaat (Vrij formaat)
  // Tik op een afbeelding in het kader: er verschijnt een kader met grepen.
  // Slepen aan een hoek verandert breedte en hoogte, aan een zijkant één van beide.
  // De afbeelding blijft gecentreerd, net als in de print.
  let selectedIndex = -1;
  const handleDirs = { nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0] };
  const handlePos = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };

  function gridImages() { return Array.from(grid.querySelectorAll('img')); }

  function removeSelection() {
    grid.querySelectorAll('.fdp-select, .fdp-size-badge').forEach(function (el) { el.remove(); });
  }

  function drawSelection() {
    removeSelection();
    const imgs = gridImages();
    imgs.forEach(function (img) { img.classList.toggle('fdp-free-img', state.mode === 'free'); });
    if (state.mode !== 'free' || selectedIndex < 0 || !imgs[selectedIndex]) return;
    const img = imgs[selectedIndex];
    const cell = img.parentElement;
    const box = document.createElement('div');
    box.className = 'fdp-select';
    box.style.width = state.width + '%';
    box.style.height = state.height + '%';
    Object.keys(handlePos).forEach(function (key) {
      const h = document.createElement('div');
      h.className = 'fdp-handle';
      h.setAttribute('data-h', key);
      // Grepen altijd binnen de afbeelding houden, zodat ze aan de rand van het vel
      // niet worden afgeknipt en altijd aan te tikken zijn.
      h.style.left = 'calc(' + handlePos[key][0] + '% - ' + (handlePos[key][0] / 100 * 44) + 'px)';
      h.style.top = 'calc(' + handlePos[key][1] + '% - ' + (handlePos[key][1] / 100 * 44) + 'px)';
      box.appendChild(h);
    });
    const badge = document.createElement('div');
    badge.className = 'fdp-size-badge';
    badge.textContent = state.width + '% × ' + state.height + '%';
    cell.appendChild(box);
    cell.appendChild(badge);
  }

  function updateSelectionBox() {
    const box = grid.querySelector('.fdp-select');
    const badge = grid.querySelector('.fdp-size-badge');
    if (box) { box.style.width = state.width + '%'; box.style.height = state.height + '%'; }
    if (badge) badge.textContent = state.width + '% × ' + state.height + '%';
  }

  // Tik op een afbeelding selecteert hem (alleen in Vrij formaat); tik ernaast deselecteert.
  grid.addEventListener('pointerdown', function (event) {
    if (event.target.closest('.fdp-handle')) return;
    const imgs = gridImages();
    const index = imgs.indexOf(event.target.closest('img'));
    if (index < 0) { selectedIndex = -1; removeSelection(); return; }
    if (state.mode !== 'free') {
      panel.querySelector('.fdp-scale__hint').textContent = 'Kies "Vrij formaat" om de afbeelding met je vinger op maat te maken.';
      return;
    }
    selectedIndex = index;
    drawSelection();
  });

  let drag = null;
  grid.addEventListener('pointerdown', function (event) {
    const handle = event.target.closest('.fdp-handle');
    if (!handle) return;
    event.preventDefault();
    const cell = handle.closest('.fdp-select').parentElement.getBoundingClientRect();
    drag = {
      handle: handle, dir: handleDirs[handle.getAttribute('data-h')],
      startX: event.clientX, startY: event.clientY,
      startW: state.width, startH: state.height, cellW: cell.width, cellH: cell.height
    };
    handle.classList.add('is-dragging');
    modal.classList.add('fdp-dragging');
    try { handle.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
  });

  grid.addEventListener('pointermove', function (event) {
    if (!drag) return;
    // Gecentreerd: een greep 10 px naar buiten maakt het beeld aan beide kanten 10 px groter.
    const dx = (event.clientX - drag.startX) * drag.dir[0];
    const dy = (event.clientY - drag.startY) * drag.dir[1];
    if (drag.dir[0]) state.width = clampPct(drag.startW + (2 * dx / drag.cellW) * 100);
    if (drag.dir[1]) state.height = clampPct(drag.startH + (2 * dy / drag.cellH) * 100);
    applyToImages(grid);
    updateSelectionBox();
    render();
    withScale(settings); // print-instelling direct bijwerken, ook als loslaten gemist wordt
  });

  function endDrag() {
    if (!drag) return;
    drag.handle.classList.remove('is-dragging');
    modal.classList.remove('fdp-dragging');
    drag = null;
    changed();
  }
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
  grid.addEventListener('lostpointercapture', endDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('blur', endDrag);

  function clampPct(value) { return Math.max(5, Math.min(100, Math.round(value))); }

  // Het bestaande script tekent het voorbeeld steeds opnieuw; daarna onze stijl toepassen.
  [grid, mainPreview].forEach(function (container) {
    if (!container) return;
    new MutationObserver(function (mutations) {
      // Eigen selectie-elementen negeren, anders blijft dit zichzelf aanroepen.
      if (drag) return; // tijdens het slepen nooit opnieuw tekenen
      const own = function (n) {
        if (!n || n.nodeType !== 1) return true; // tekst-wijzigingen (bijv. het maatlabel) negeren
        return n.classList.contains('fdp-select') || n.classList.contains('fdp-size-badge') || !!n.closest('.fdp-select, .fdp-size-badge');
      };
      const external = mutations.some(function (m) {
        if (m.target.nodeType === 1 && m.target.closest('.fdp-select, .fdp-size-badge')) return false;
        return Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).some(function (n) { return !own(n); });
      });
      if (!external) return;
      applyToImages(container);
      if (container === grid) drawSelection();
    }).observe(container, { childList: true, subtree: true });
  });

  // Start in dezelfde stand als het oude vinkje (standaard aan = Vullen), zodat de
  // standaardprint niet verandert.
  state.mode = fitCheckbox.checked ? 'fill' : 'fit';
  changed();
})();
