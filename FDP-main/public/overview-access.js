// Overzichtspagina per rol.
// - Locatie: alleen de tab en stations van die locatie.
// - Beheer (eigenaar): alle tabs, plus de links van de locaties om te delen.
// window.FDPAccess wordt door de server in de pagina gezet.
(function () {
  const access = window.FDPAccess;
  if (!access) return;

  const subtitle = document.getElementById('overview-subtitle');

  function activateTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tab-content').forEach(function (el) {
      el.classList.toggle('active', el.id === name);
    });
  }

  if (access.role === 'location') {
    document.title = 'FD Printing Center - ' + access.label;
    if (subtitle) subtitle.textContent = 'Locatie ' + access.label;
    // Alleen de eigen locatie tonen; de rest helemaal uit de pagina halen.
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      if (btn.getAttribute('data-tab') !== access.location) btn.remove();
    });
    document.querySelectorAll('.tab-content').forEach(function (el) {
      if (el.id !== access.location) el.remove();
    });
    activateTab(access.location);
    const tabBar = document.querySelector('.tab-btn') && document.querySelector('.tab-btn').parentElement;
    if (tabBar) tabBar.style.display = 'none';
    return;
  }

  if (access.role !== 'owner') return;

  document.title = 'FD Printing Center - Beheer';
  if (subtitle) subtitle.textContent = 'Beheer - alle locaties';

  const style = document.createElement('style');
  style.textContent = [
    '.fdp-links{margin:0 0 2rem;border-radius:1rem;background:#fff;border:1px solid #e4e4e7;box-shadow:0 4px 14px rgba(0,0,0,.05);padding:1.25rem 1.25rem 1rem;',
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.fdp-links summary{cursor:pointer;font-weight:800;font-size:1.1rem;color:#18181b;list-style:none;display:flex;align-items:center;justify-content:space-between}',
    '.fdp-links summary::-webkit-details-marker{display:none}',
    '.fdp-links summary::after{content:"▾";color:#dc2626;transition:transform .25s ease}',
    '.fdp-links[open] summary::after{transform:rotate(180deg)}',
    '.fdp-links__note{margin:.5rem 0 1rem;font-size:.9rem;color:#52525b}',
    '.fdp-links__row{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;padding:.75rem 0;border-top:1px solid #f4f4f5}',
    '.fdp-links__name{flex:0 0 7rem;font-weight:800;color:#18181b}',
    '.fdp-links__url{flex:1 1 18rem;min-width:0;font:600 .85rem ui-monospace,Menlo,Consolas,monospace;color:#3f3f46;background:#f4f4f5;',
    'border-radius:.5rem;padding:.55rem .7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:all}',
    '.fdp-links__btn{border:0;border-radius:999px;padding:.55rem 1rem;min-height:44px;font-weight:800;font-size:.9rem;cursor:pointer;',
    'text-decoration:none;display:inline-flex;align-items:center}',
    '.fdp-links__btn--copy{background:#dc2626;color:#fff}',
    '.fdp-links__btn--open{background:#f4f4f5;color:#18181b}',
    '.fdp-links__btn.is-done{background:#16a34a}'
  ].join('');
  document.head.appendChild(style);

  const box = document.createElement('details');
  box.className = 'fdp-links';
  const origin = window.location.origin;
  box.innerHTML = '<summary>Links voor de locaties</summary>'
    + '<p class="fdp-links__note">Geef elke locatie alleen haar eigen link. Medewerkers zien en bedienen dan alleen de stations van hun eigen locatie. Deze beheerpagina is alleen voor jou.</p>'
    + (access.locations || []).map(function (loc) {
      const url = origin + loc.path;
      return '<div class="fdp-links__row">'
        + '<span class="fdp-links__name">' + loc.label + '</span>'
        + '<span class="fdp-links__url" title="' + url + '">' + url + '</span>'
        + '<button type="button" class="fdp-links__btn fdp-links__btn--copy" data-copy="' + url + '">Kopieer link</button>'
        + '<a class="fdp-links__btn fdp-links__btn--open" href="' + loc.path + '" target="_blank" rel="noopener">Open</a>'
        + '</div>';
    }).join('');

  const container = document.querySelector('main .max-w-6xl') || document.querySelector('main');
  if (container) container.insertBefore(box, container.firstChild);

  box.addEventListener('click', function (event) {
    const btn = event.target.closest('[data-copy]');
    if (!btn) return;
    const text = btn.getAttribute('data-copy');
    const done = function () {
      btn.textContent = 'Gekopieerd';
      btn.classList.add('is-done');
      setTimeout(function () { btn.textContent = 'Kopieer link'; btn.classList.remove('is-done'); }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('Kopieer deze link:', text); });
    } else {
      window.prompt('Kopieer deze link:', text);
    }
  });
})();
