(function () {
  const STYLE_ID = 'fdp-session-timeout-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      body.fdp-session-modal-open {
        overflow: hidden;
      }

      .fdp-session-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        background: rgba(24, 24, 27, 0.72);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }

      .fdp-session-modal-backdrop.hidden {
        display: none;
      }

      .fdp-session-modal {
        width: min(100%, 32rem);
        border-radius: 1.5rem;
        border: 1px solid rgba(255, 255, 255, 0.78);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.98) 100%);
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.28);
        overflow: hidden;
      }

      .fdp-session-modal__header {
        padding: 1.5rem 1.75rem 1rem;
        background: linear-gradient(135deg, rgb(185, 28, 28) 0%, rgb(220, 38, 38) 100%);
        color: #ffffff;
      }

      .fdp-session-modal__eyebrow {
        margin: 0 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.82;
      }

      .fdp-session-modal__title {
        margin: 0;
        font-size: 1.75rem;
        line-height: 1.15;
        font-weight: 800;
      }

      .fdp-session-modal__body {
        padding: 1.5rem 1.75rem 1.75rem;
        color: rgb(39, 39, 42);
      }

      .fdp-session-modal__text {
        margin: 0;
        font-size: 1rem;
        line-height: 1.65;
      }

      .fdp-session-modal__countdown {
        margin: 1rem 0 0;
        padding: 0.9rem 1rem;
        border-radius: 1rem;
        background: rgb(254, 242, 242);
        border: 1px solid rgb(254, 202, 202);
        color: rgb(153, 27, 27);
        font-size: 0.95rem;
        font-weight: 700;
        line-height: 1.5;
      }

      .fdp-session-modal__actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1.25rem;
      }

      .fdp-session-modal__button {
        flex: 1;
        border: 0;
        border-radius: 999px;
        padding: 0.95rem 1.1rem;
        font-size: 1rem;
        font-weight: 800;
        cursor: pointer;
        transition: transform 0.18s ease, opacity 0.18s ease, background 0.18s ease;
      }

      .fdp-session-modal__button:hover {
        transform: translateY(-1px);
      }

      .fdp-session-modal__button:disabled {
        cursor: wait;
        opacity: 0.7;
        transform: none;
      }

      .fdp-session-modal__button--secondary {
        background: rgb(39, 39, 42);
        color: #ffffff;
      }

      .fdp-session-modal__button--secondary:hover {
        background: rgb(24, 24, 27);
      }

      .fdp-session-modal__button--primary {
        background: rgb(220, 38, 38);
        color: #ffffff;
      }

      .fdp-session-modal__button--primary:hover {
        background: rgb(185, 28, 28);
      }

      @media (max-width: 640px) {
        .fdp-session-modal__title {
          font-size: 1.45rem;
        }

        .fdp-session-modal__actions {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function formatRemaining(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return minutes + ':' + seconds;
  }

  function createElement(tagName, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    return element;
  }

  window.createSessionTimeoutController = function createSessionTimeoutController(options) {
    if (!options || typeof options.restartSession !== 'function') {
      throw new Error('Session timeout requires a restartSession function.');
    }

    injectStyles();

    const minimumMs = Number.isFinite(options.minimumMs) ? options.minimumMs : 5 * 60 * 1000;
    const responseMs = Number.isFinite(options.responseMs) ? options.responseMs : 60 * 1000;
    const translate = typeof options.translate === 'function' ? options.translate : function (key) { return key; };

    let promptTimerId = null;
    let responseTimerId = null;
    let countdownTimerId = null;
    let responseDeadline = 0;
    let resetInProgress = false;

    const backdrop = createElement('div', 'fdp-session-modal-backdrop hidden');
    backdrop.setAttribute('aria-hidden', 'true');

    const modal = createElement('div', 'fdp-session-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'fdp-session-modal-title');

    const header = createElement('div', 'fdp-session-modal__header');
    const eyebrow = createElement('p', 'fdp-session-modal__eyebrow');
    eyebrow.textContent = 'FD Printing Center';
    const title = createElement('h2', 'fdp-session-modal__title');
    title.id = 'fdp-session-modal-title';

    const body = createElement('div', 'fdp-session-modal__body');
    const text = createElement('p', 'fdp-session-modal__text');
    const countdown = createElement('p', 'fdp-session-modal__countdown');
    const actions = createElement('div', 'fdp-session-modal__actions');
    const noButton = createElement('button', 'fdp-session-modal__button fdp-session-modal__button--secondary');
    const yesButton = createElement('button', 'fdp-session-modal__button fdp-session-modal__button--primary');

    noButton.type = 'button';
    yesButton.type = 'button';

    actions.appendChild(noButton);
    actions.appendChild(yesButton);
    body.appendChild(text);
    body.appendChild(countdown);
    body.appendChild(actions);
    header.appendChild(eyebrow);
    header.appendChild(title);
    modal.appendChild(header);
    modal.appendChild(body);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function clearPromptTimer() {
      if (promptTimerId) {
        window.clearTimeout(promptTimerId);
        promptTimerId = null;
      }
    }

    function clearResponseTimers() {
      if (responseTimerId) {
        window.clearTimeout(responseTimerId);
        responseTimerId = null;
      }

      if (countdownTimerId) {
        window.clearInterval(countdownTimerId);
        countdownTimerId = null;
      }
    }

    function updateCountdownText() {
      const remainingMs = responseDeadline ? Math.max(0, responseDeadline - Date.now()) : responseMs;
      countdown.textContent = translate('sessionAutoResetText') + ' ' + formatRemaining(remainingMs);
    }

    function syncText() {
      title.textContent = translate('sessionDoneTitle');
      text.textContent = translate('sessionDoneText');
      yesButton.textContent = translate('sessionDoneYes');
      noButton.textContent = translate('sessionDoneNo');
      updateCountdownText();
    }

    function closeModal() {
      clearResponseTimers();
      responseDeadline = 0;
      backdrop.classList.add('hidden');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('fdp-session-modal-open');
    }

    async function executeReset() {
      if (resetInProgress) return;

      resetInProgress = true;
      clearPromptTimer();
      yesButton.disabled = true;
      noButton.disabled = true;
      closeModal();

      try {
        await options.restartSession();
      } catch (error) {
        console.error('Session timeout restart failed:', error);
      } finally {
        yesButton.disabled = false;
        noButton.disabled = false;
        resetInProgress = false;
        schedulePrompt();
      }
    }

    function openModal() {
      if (resetInProgress) return;

      syncText();
      backdrop.classList.remove('hidden');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.classList.add('fdp-session-modal-open');

      responseDeadline = Date.now() + responseMs;
      clearResponseTimers();
      responseTimerId = window.setTimeout(executeReset, responseMs);
      countdownTimerId = window.setInterval(updateCountdownText, 1000);
      updateCountdownText();
    }

    function schedulePrompt() {
      clearPromptTimer();
      promptTimerId = window.setTimeout(openModal, minimumMs);
    }

    yesButton.addEventListener('click', executeReset);
    noButton.addEventListener('click', function () {
      closeModal();
      schedulePrompt();
    });

    return {
      start: function () {
        closeModal();
        schedulePrompt();
      },
      refresh: function () {
        if (!backdrop.classList.contains('hidden')) {
          syncText();
        }
      },
      restartTimer: function () {
        closeModal();
        schedulePrompt();
      },
      wrapRestart: function (restartFn) {
        return async function wrappedSessionRestart() {
          clearPromptTimer();
          closeModal();

          try {
            return await restartFn.apply(this, arguments);
          } finally {
            schedulePrompt();
          }
        };
      }
    };
  };
})();