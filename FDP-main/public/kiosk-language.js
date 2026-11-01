// Taalkeuze-pop-up (Nederlands / English) die verschijnt zodra de computer
// wordt geactiveerd, op het moment dat de prijslijst verdwijnt.
// Laden NA kiosk-lock.js.
(function () {
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const spring = 'cubic-bezier(.34,1.56,.64,1)';

  const style = document.createElement('style');
  style.textContent = [
    '.fdp-lang{position:fixed;inset:0;z-index:99995;display:flex;align-items:center;justify-content:center;padding:1.5rem;',
    'background:rgba(15,15,15,.5);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;visibility:hidden;',
    'transition:opacity .35s ease,visibility 0s linear .35s}',
    '.fdp-lang.is-open{opacity:1;visibility:visible;transition:opacity .35s ease,visibility 0s}',
    '.fdp-lang__card{width:min(38rem,100%);background:#fff;border-radius:2rem;padding:2.25rem 2rem 2rem;text-align:center;',
    'box-shadow:0 40px 90px rgba(0,0,0,.35);font-family:Manrope,system-ui,sans-serif;transform:translateY(40px) scale(.85);opacity:0;',
    'transition:transform .6s ' + spring + ',opacity .3s ease}',
    '.fdp-lang.is-open .fdp-lang__card{transform:none;opacity:1}',
    '.fdp-lang__hello{margin:0;font-size:.85rem;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#dc2626}',
    '.fdp-lang__title{margin:.4rem 0 0;font-size:2rem;font-weight:900;color:#18181b;line-height:1.15}',
    '.fdp-lang__sub{margin:.35rem 0 0;font-size:1.05rem;color:#71717a}',
    '.fdp-lang__options{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.75rem}',
    '.fdp-lang__btn,html.fdp-touch .fdp-lang__btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:.8rem;',
    'padding:1.5rem 1rem;border:2px solid #e4e4e7;border-radius:1.5rem;background:#fafafa;cursor:pointer;font:800 1.3rem Manrope,system-ui,sans-serif;',
    'color:#18181b;opacity:0;transform:translateY(16px);transition:transform .35s ' + spring + ',border-color .2s ease,background .2s ease,box-shadow .3s ease}',
    '.fdp-lang.is-open .fdp-lang__btn{animation:fdpLangBtnIn .55s ' + ease + ' forwards}',
    '.fdp-lang.is-open .fdp-lang__btn:nth-child(2){animation-delay:.08s}',
    '@keyframes fdpLangBtnIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
    '.fdp-lang__btn.is-current{border-color:#dc2626;background:#fef2f2;box-shadow:0 12px 28px rgba(220,38,38,.18)}',
    '.fdp-lang__btn:active{transform:scale(.95) !important}',
    '.fdp-lang__flag{width:96px;height:64px;border-radius:.6rem;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.18)}',
    '.fdp-lang__flag svg{display:block;width:100%;height:100%}',
    '@media (prefers-reduced-motion:reduce){.fdp-lang__card,.fdp-lang__btn{transition:none;animation:none !important;opacity:1;transform:none}}'
  ].join('');
  document.head.appendChild(style);

  const flagNl = '<svg viewBox="0 0 9 6" preserveAspectRatio="none"><rect width="9" height="6" fill="#21468B"/><rect width="9" height="4" fill="#fff"/><rect width="9" height="2" fill="#AE1C28"/></svg>';
  const flagUk = '<svg viewBox="0 0 60 30" preserveAspectRatio="none"><clipPath id="fdpUkClip"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>'
    + '<path d="M0,0 v30 h60 v-30 z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>'
    + '<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#fdpUkClip)" stroke="#C8102E" stroke-width="4"/>'
    + '<path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>';

  const overlay = document.createElement('div');
  overlay.className = 'fdp-lang';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = '<div class="fdp-lang__card">'
    + '<p class="fdp-lang__hello">Welkom · Welcome</p>'
    + '<p class="fdp-lang__title">Kies je taal<br>Choose your language</p>'
    + '<div class="fdp-lang__options">'
    + '<button type="button" class="fdp-lang__btn" data-lang="nl"><span class="fdp-lang__flag">' + flagNl + '</span>Nederlands</button>'
    + '<button type="button" class="fdp-lang__btn" data-lang="en"><span class="fdp-lang__flag">' + flagUk + '</span>English</button>'
    + '</div></div>';
  document.body.appendChild(overlay);

  function currentLang() {
    try { return localStorage.getItem('fdp-lang') === 'en' ? 'en' : 'nl'; } catch (error) { return 'nl'; }
  }

  function open() {
    overlay.querySelectorAll('.fdp-lang__btn').forEach(function (btn) {
      btn.classList.toggle('is-current', btn.getAttribute('data-lang') === currentLang());
    });
    document.body.classList.add('fdp-choosing-language');
    overlay.classList.remove('is-open');
    void overlay.offsetWidth; // animatie opnieuw starten
    overlay.classList.add('is-open');
  }

  function choose(lang) {
    // De bestaande taalknop wisselt tussen NL en EN; klik hem alleen als de taal verandert.
    if (lang !== currentLang()) {
      const toggle = document.getElementById('language-toggle');
      if (toggle) toggle.click();
    }
    overlay.classList.remove('is-open');
    document.body.classList.remove('fdp-choosing-language');
    window.dispatchEvent(new CustomEvent('fdp-language-chosen', { detail: { lang: lang } }));
  }

  overlay.addEventListener('click', function (event) {
    const btn = event.target.closest('.fdp-lang__btn');
    if (btn) choose(btn.getAttribute('data-lang'));
  });

  // Komt van kiosk-lock.js op het moment dat de prijslijst verdwijnt.
  window.addEventListener('fdp-kiosk-unlocked', open);

  // Als de computer weer vergrendeld wordt, sluit de taalkeuze.
  window.addEventListener('fdp-station-status', function (event) {
    const status = event.detail && event.detail.status;
    if ((status === 'idle' || status === 'stopped') && overlay.classList.contains('is-open')) {
      overlay.classList.remove('is-open');
      document.body.classList.remove('fdp-choosing-language');
    }
  });
})();
