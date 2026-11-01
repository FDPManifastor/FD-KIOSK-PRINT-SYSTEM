// Bewegende iconen op de knoppen boven de uploads (nu alleen TEST COPY 1):
// - Download alles: pijl die steeds in het bakje zakt
// - Edit Layout wordt "Impose": een vel papier dat wisselt van
//   1 pagina naar 2 pagina's naar 4 pagina's op één vel
// - Alles printen: printer waar een vel papier uit komt
(function () {
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const style = document.createElement('style');
  style.textContent = [
    '.fdp-btn-icon{display:inline-flex;align-items:center;gap:.55rem}',
    '.fdp-btn-icon svg{flex:none;overflow:visible}',

    // Download: pijl zakt in het bakje en komt opnieuw in beeld
    '.fdp-dl-icon{width:22px;height:22px}',
    '.fdp-dl-arrow{animation:fdpDlDrop 1.6s ' + ease + ' infinite}',
    '@keyframes fdpDlDrop{0%{transform:translateY(-7px);opacity:0}25%{opacity:1}60%{transform:translateY(2px);opacity:1}',
    '80%,100%{transform:translateY(4px);opacity:0}}',
    '.fdp-dl-tray{animation:fdpDlTray 1.6s ease-in-out infinite;transform-origin:12px 20px}',
    '@keyframes fdpDlTray{0%,55%{transform:scaleX(1)}68%{transform:scaleX(1.12)}80%,100%{transform:scaleX(1)}}',

    // Alles printen: vel papier komt uit de printer, lampje knippert
    '.fdp-pr-icon{width:24px;height:24px}',
    '.fdp-pr-paper{animation:fdpPrPaper 1.9s ' + ease + ' infinite}',
    '@keyframes fdpPrPaper{0%{transform:translateY(-9px);opacity:1}55%{transform:translateY(0);opacity:1}80%{transform:translateY(1px);opacity:1}100%{transform:translateY(3px);opacity:0}}',
    '.fdp-pr-body{animation:fdpPrBody 1.9s ease-in-out infinite;transform-origin:12px 12px}',
    '@keyframes fdpPrBody{0%,100%{transform:translateY(0)}10%,30%,50%{transform:translateY(-.4px)}20%,40%{transform:translateY(.4px)}}',
    '.fdp-pr-light{animation:fdpPrLight .95s steps(1) infinite}',
    '@keyframes fdpPrLight{0%{opacity:1}50%{opacity:.2}}',

    // Impose: 1 -> 2 -> 4 pagina's op één vel
    '.fdp-impose-icon{width:30px;height:30px}',
    '.fdp-impose-sheet{animation:fdpImposeSheet 4.2s ease-in-out infinite;transform-origin:15px 15px}',
    '@keyframes fdpImposeSheet{0%,28%,33%,61%,66%,94%,100%{transform:scale(1)}30%,63%,96%{transform:scale(1.08)}}',
    '.fdp-impose-step{opacity:0;transform-origin:15px 15px;animation:fdpImposeStep 4.2s ' + ease + ' infinite}',
    '.fdp-impose-step--2{animation-delay:1.4s}',
    '.fdp-impose-step--4{animation-delay:2.8s}',
    '@keyframes fdpImposeStep{0%{opacity:0;transform:scale(.7)}6%{opacity:1;transform:scale(1)}28%{opacity:1;transform:scale(1)}',
    '33%,100%{opacity:0;transform:scale(1.1)}}',

    '@media (prefers-reduced-motion:reduce){.fdp-dl-arrow,.fdp-dl-tray,.fdp-impose-sheet,.fdp-impose-step,.fdp-pr-paper,.fdp-pr-body,.fdp-pr-light{animation:none}',
    '.fdp-dl-arrow{opacity:1;transform:none}.fdp-impose-step--4{opacity:1}}'
  ].join('');
  document.head.appendChild(style);

  const downloadIcon = '<svg class="fdp-dl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<g class="fdp-dl-arrow"><path d="M12 3v11"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/></g>'
    + '<path class="fdp-dl-tray" d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>';

  // Printer waar een vel papier uit komt (het vel is alleen onder de uitvoersleuf zichtbaar).
  const printIcon = '<svg class="fdp-pr-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<defs><clipPath id="fdpPrClip"><rect x="0" y="14" width="24" height="10"/></clipPath></defs>'
    + '<g class="fdp-pr-body"><path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M6.5 14h11"/>'
    + '<circle class="fdp-pr-light" cx="17.6" cy="10.8" r=".9" fill="currentColor" stroke="none"/></g>'
    + '<g clip-path="url(#fdpPrClip)"><g class="fdp-pr-paper"><rect x="7.5" y="12" width="9" height="10" rx=".8" fill="currentColor" fill-opacity=".25"/>'
    + '<path d="M9.5 17h5M9.5 19.3h3.5" stroke-width="1.4"/></g></g></svg>';

  // Vel papier (staand) met daarin 1, 2 of 4 pagina's.
  const imposeIcon = '<svg class="fdp-impose-icon" viewBox="0 0 30 30" fill="none" aria-hidden="true">'
    + '<g class="fdp-impose-sheet">'
    + '<rect x="6" y="2" width="18" height="26" rx="2" stroke="currentColor" stroke-width="2"/>'
    // 1 pagina
    + '<g class="fdp-impose-step fdp-impose-step--1"><rect x="9" y="5" width="12" height="20" rx="1" fill="currentColor" opacity=".9"/></g>'
    // 2 pagina's
    + '<g class="fdp-impose-step fdp-impose-step--2"><rect x="9" y="5" width="12" height="9" rx="1" fill="currentColor" opacity=".9"/>'
    + '<rect x="9" y="16" width="12" height="9" rx="1" fill="currentColor" opacity=".9"/></g>'
    // 4 pagina's
    + '<g class="fdp-impose-step fdp-impose-step--4"><rect x="9" y="5" width="5.5" height="9" rx=".8" fill="currentColor" opacity=".9"/>'
    + '<rect x="15.5" y="5" width="5.5" height="9" rx=".8" fill="currentColor" opacity=".9"/>'
    + '<rect x="9" y="16" width="5.5" height="9" rx=".8" fill="currentColor" opacity=".9"/>'
    + '<rect x="15.5" y="16" width="5.5" height="9" rx=".8" fill="currentColor" opacity=".9"/></g>'
    + '</g></svg>';

  function decorate(button, icon, label) {
    if (!button) return;
    const text = label || button.textContent.trim();
    if (button.dataset.fdpIconLabel === text && button.querySelector('svg')) return;
    button.dataset.fdpIconLabel = text;
    button.classList.add('fdp-btn-icon');
    button.innerHTML = icon + '<span>' + text.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    }) + '</span>';
  }

  function decorateAll() {
    decorate(document.getElementById('download-all-files'), downloadIcon);
    decorate(document.getElementById('print-all-files'), printIcon);
    decorate(document.getElementById('open-edit-layout-modal'), imposeIcon, 'Impose');
  }

  // files-page.js zet de tekst van "Download alles" opnieuw bij een taalwissel;
  // daarna het icoon terugzetten.
  const toggle = document.getElementById('language-toggle');
  if (toggle) toggle.addEventListener('click', function () { setTimeout(decorateAll, 0); });

  decorateAll();
})();
