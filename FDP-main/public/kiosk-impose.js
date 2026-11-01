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
    'label:has(> #edit-layout-fit-frame){display:none !important}'
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

  const footer = copiesInput.closest('.mt-4');
  if (footer && footer.parentNode) footer.parentNode.insertBefore(panel, footer);
  else modal.querySelector('.modal-content').appendChild(panel);

  const hints = {
    fit: 'De hele afbeelding blijft in verhouding zichtbaar. Maak hem kleiner met de schuif of −.',
    fill: 'De afbeelding vult het hele kader; wat buiten het kader valt wordt bijgesneden.',
    free: 'Breedte en hoogte los instellen. Let op: de afbeelding kan hierdoor uitgerekt worden.'
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
    // Het oude vinkje bijhouden zodat het bestaande voorbeeld klopt.
    const wantFill = state.mode === 'fill';
    if (fitCheckbox.checked !== wantFill) {
      fitCheckbox.checked = wantFill;
      fitCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
    withScale(settings);
    render();
    applyEverywhere();
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

  // Het bestaande script tekent het voorbeeld steeds opnieuw; daarna onze stijl toepassen.
  [grid, mainPreview].forEach(function (container) {
    if (container) new MutationObserver(function () { applyToImages(container); }).observe(container, { childList: true, subtree: true });
  });

  // Start in dezelfde stand als het oude vinkje (standaard aan = Vullen), zodat de
  // standaardprint niet verandert.
  state.mode = fitCheckbox.checked ? 'fill' : 'fit';
  changed();
})();
