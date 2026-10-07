(function () {
  const config = window.FDPFilesPageConfig;

  if (!config || !config.folderName || !config.uploadPath) {
    throw new Error('FDP files page config is missing.');
  }

  const folderName = config.folderName;
  const uploadPath = config.uploadPath;
  const copyNumberMatch = folderName.match(/copy(\d+)/i);
  const copyNumber = copyNumberMatch ? copyNumberMatch[1] : '';
  const copyLabel = config.copyLabel || ('COPY ' + copyNumber);
  const uploaderTokenKey = 'fdp-uploader-' + folderName;
  const languageKey = 'fdp-lang';
  const currentParams = new URLSearchParams(window.location.search);

  const filesStatus = document.getElementById('files-status');
  const filesList = document.getElementById('files-list');
  const refreshButton = document.getElementById('refresh-files');
  const qrImage = document.getElementById('qr-image');
  const uploadLink = document.getElementById('upload-link');
  const finishButton = document.getElementById('finish-btn');
  const languageToggle = document.getElementById('language-toggle');
  const currentLangLabel = document.getElementById('current-lang');
  const previewEmpty = document.getElementById('preview-empty');
  const previewContent = document.getElementById('preview-content');

  let currentLanguage = localStorage.getItem(languageKey) || 'nl';
  let currentAccessCode = currentParams.get('access') || '';
  let lastFileKeys = null;

  const translations = {
    nl: {
      pageTitle: 'FD Printing Center - Bestanden {copyLabel}',
      langLabel: 'NL',
      stepLabel: 'Stap 1: Scan QR-code',
      quickAccessLabel: 'Snelle toegang',
      scanUploadText: 'Scan en upload bestand',
      uploadLinkText: 'Open uploadpagina {copyLabel}',
      newSessionBtn: 'Nieuwe sessie',
      refreshBtn: 'Ververs',
      sessionDoneTitle: 'Ben je klaar met je sessie?',
      sessionDoneText: 'Als je klaar bent, wordt de sessie afgesloten en worden alle bestanden verwijderd.',
      sessionDoneYes: 'Ja',
      sessionDoneNo: 'Nee',
      sessionAutoResetText: 'Geen reactie ontvangen. De sessie wordt automatisch opnieuw gestart over',
      finishBtn: 'Klaar',
      finishNote: 'Klik op klaar wanneer je klaar bent om al je bestanden te verwijderen.',
      guideTitle: 'Handleiding:',
      guideStep1: '1. Scan de QR-code hierboven of open de uploadpagina van {copyLabel}.',
      guideStep2: '2. Upload jouw bestand vanaf je telefoon, tablet of laptop.',
      guideStep3: '3. Wacht tot het bestand hieronder verschijnt in de lijst met uploads.',
      guideStep4: '4. Klik op Voorbeeld of Download om het bestand te openen.',
      guideTip: '<strong>Tip:</strong> Het is mogelijk om het bestand te renderen naar PDF voordat je het downloadt.',
      liveBadge: 'Live',
      uploadsTitle: 'Uploads',
      previewTitle: 'Bestandsvoorbeeld',
      previewSubtitle: 'Klik op Voorbeeld om de inhoud hier direct te zien.',
      previewEmpty: 'Nog geen voorbeeld geselecteerd.',
      previewImageAlt: 'Voorbeeld van bestand',
      qrAltText: 'QR-code naar de uploadpagina van {copyLabel}',
      filesLoading: 'Bestanden laden...',
      filesEmpty: 'Nog geen bestanden geupload.',
      filesError: 'Kon bestanden niet laden.',
      filesUnauthorized: 'Deze prive-link is verlopen of niet meer geldig.',
      previewLoading: 'Voorbeeld laden...',
      previewUnsupported: 'Voor dit bestandstype is geen inline voorbeeld. Gebruik Download of PDF.',
      previewTextError: 'Kon tekstvoorbeeld niet laden.',
      downloadBtnLabel: 'Download',
      previewBtnLabel: 'Voorbeeld',
      pdfBtnLabel: 'PDF',
      deleteBtnLabel: 'Verwijderen',
      deleteConfirm: 'Weet je zeker dat je dit bestand wilt verwijderen?',
      deleteError: 'Kon bestand niet verwijderen.',
      fileBadgeNew: 'nieuw',
      fileBadgeReady: 'klaar'
    },
    en: {
      pageTitle: 'FD Printing Center - Files {copyLabel}',
      langLabel: 'EN',
      stepLabel: 'Step 1: Scan QR Code',
      quickAccessLabel: 'Quick access',
      scanUploadText: 'Scan and upload file',
      uploadLinkText: 'Open {copyLabel} upload page',
      newSessionBtn: 'New session',
      refreshBtn: 'Refresh',
      sessionDoneTitle: 'Are you done with your session?',
      sessionDoneText: 'If you are finished, the session will end and all files will be deleted.',
      sessionDoneYes: 'Yes',
      sessionDoneNo: 'No',
      sessionAutoResetText: 'No response received. The session will automatically restart in',
      finishBtn: 'Finish',
      finishNote: 'Click finish when you are done to delete all your files.',
      guideTitle: 'Instructions:',
      guideStep1: '1. Scan the QR code above or open the {copyLabel} upload page.',
      guideStep2: '2. Upload your file from your phone, tablet, or laptop.',
      guideStep3: '3. Wait until the file appears below in the uploads list.',
      guideStep4: '4. Click Preview or Download to open the file.',
      guideTip: '<strong>Tip:</strong> You can render the file to PDF before downloading it.',
      liveBadge: 'Live',
      uploadsTitle: 'Uploads',
      previewTitle: 'File preview',
      previewSubtitle: 'Click Preview to see the file content here instantly.',
      previewEmpty: 'No preview selected yet.',
      previewImageAlt: 'File preview',
      qrAltText: 'QR code to the {copyLabel} upload page',
      filesLoading: 'Loading files...',
      filesEmpty: 'No files uploaded yet.',
      filesError: 'Could not load files.',
      filesUnauthorized: 'This private link has expired or is no longer valid.',
      previewLoading: 'Loading preview...',
      previewUnsupported: 'Inline preview is not available for this file type. Use Download or PDF.',
      previewTextError: 'Could not load text preview.',
      downloadBtnLabel: 'Download',
      previewBtnLabel: 'Preview',
      pdfBtnLabel: 'PDF',
      deleteBtnLabel: 'Delete',
      deleteConfirm: 'Are you sure you want to delete this file?',
      deleteError: 'Could not delete file.',
      fileBadgeNew: 'new',
      fileBadgeReady: 'ready'
    }
  };

  function escapeHtml(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getStoredUploaderToken() {
    return localStorage.getItem(uploaderTokenKey) || '';
  }

  function hasSecureFetchAccess() {
    return Boolean(currentAccessCode || getStoredUploaderToken());
  }

  function hasSecureAssetAccess() {
    return Boolean(currentAccessCode);
  }

  function accessQuery() {
    return currentAccessCode ? '?access=' + encodeURIComponent(currentAccessCode) : '';
  }

  function secureHeaders() {
    const uploaderToken = getStoredUploaderToken();
    return uploaderToken ? { 'x-uploader-token': uploaderToken } : {};
  }

  function formatText(value) {
    return value.replaceAll('{copyLabel}', copyLabel);
  }

  function t(key) {
    const languagePack = translations[currentLanguage] || translations.nl;
    const fallbackValue = translations.nl[key] || key;
    const value = languagePack[key] || fallbackValue;
    return typeof value === 'string' ? formatText(value) : value;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = value;
  }

  function applyLanguage() {
    currentLangLabel.textContent = t('langLabel');
    setText('step-label', t('stepLabel'));
    setText('quick-access-label', t('quickAccessLabel'));
    setText('scan-upload-text', t('scanUploadText'));
    setText('upload-link', t('uploadLinkText'));
    setText('new-session-btn', t('newSessionBtn'));
    setText('guide-title', t('guideTitle'));
    setText('guide-step-1', t('guideStep1'));
    setText('guide-step-2', t('guideStep2'));
    setText('guide-step-3', t('guideStep3'));
    setText('guide-step-4', t('guideStep4'));
    setHtml('guide-tip', t('guideTip'));
    setText('live-badge-text', t('liveBadge'));
    setText('uploads-title', t('uploadsTitle'));
    setText('refresh-files', t('refreshBtn'));
    setText('finish-btn', t('finishBtn'));
    setText('finish-note', t('finishNote'));
    setText('preview-title', t('previewTitle'));
    setText('preview-subtitle', t('previewSubtitle'));
    document.title = t('pageTitle');
    qrImage.alt = t('qrAltText');

    if (previewContent.classList.contains('hidden')) {
      previewEmpty.textContent = t('previewEmpty');
    }
  }

  function qrProviderUrl(provider, value) {
    const encoded = encodeURIComponent(value);
    if (provider === 'local') {
      return '/qr?size=700&text=' + encoded;
    }
    if (provider === 'quickchart') {
      return 'https://quickchart.io/qr?size=700&text=' + encoded;
    }
    return 'https://api.qrserver.com/v1/create-qr-code/?size=700x700&data=' + encoded;
  }

  function setQrWithFallback(imgElement, value) {
    let stage = 0;
    imgElement.onerror = function () {
      stage += 1;
      if (stage === 1) {
        imgElement.src = qrProviderUrl('quickchart', value);
        return;
      }
      if (stage === 2) {
        imgElement.src = qrProviderUrl('qrserver', value);
        return;
      }
      imgElement.onerror = null;
    };
    imgElement.src = qrProviderUrl('local', value);
  }

  function setQrCode() {
    const absoluteUploadUrl = window.location.origin + uploadPath;
    uploadLink.href = absoluteUploadUrl;
    setQrWithFallback(qrImage, absoluteUploadUrl);
  }

  function resetPreview() {
    previewContent.innerHTML = '';
    previewContent.classList.add('hidden');
    previewEmpty.classList.remove('hidden');
    previewEmpty.textContent = t('previewEmpty');
  }

  function fileStatusBadge(isNew) {
    if (isNew) {
      return '<span class="shrink-0 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-xs font-bold text-red-700">' + t('fileBadgeNew') + '</span>';
    }
    return '<span class="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">' + t('fileBadgeReady') + '</span>';
  }

  function buildAssetUrl(type, encodedFileName) {
    const publicBase = {
      download: '/download/' + folderName + '/' + encodedFileName,
      preview: '/preview/' + folderName + '/' + encodedFileName,
      textPreview: '/text-preview/' + folderName + '/' + encodedFileName,
      renderPdf: '/render-pdf/' + folderName + '/' + encodedFileName
    };

    if (!hasSecureAssetAccess()) {
      return publicBase[type];
    }

    const secureBase = {
      download: '/secure/download/' + folderName + '/' + encodedFileName,
      preview: '/secure/preview/' + folderName + '/' + encodedFileName,
      textPreview: '/secure/text-preview/' + folderName + '/' + encodedFileName,
      renderPdf: '/secure/render-pdf/' + folderName + '/' + encodedFileName
    };

    return secureBase[type] + accessQuery();
  }

  function buildListMarkup(files, previousFiles) {
    const newFileSet = new Set(files.filter(function (fileName) {
      return previousFiles.indexOf(fileName) === -1;
    }));

    return files.map(function (fileName) {
      const safeName = escapeHtml(fileName);
      const encodedFile = encodeURIComponent(fileName);
      const isNew = newFileSet.has(fileName) && previousFiles.length > 0;

      return '<li class="rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm' + (isNew ? ' new-file-highlight' : '') + '">'
        + '<div class="flex items-start justify-between gap-2 mb-2">'
        + '<div class="text-xs text-zinc-800 break-all font-semibold leading-snug">' + safeName + '</div>'
        + fileStatusBadge(isNew)
        + '</div>'
        + '<div class="flex flex-wrap gap-1.5">'
        + '<a class="soft-btn bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5" href="' + buildAssetUrl('download', encodedFile) + '">' + t('downloadBtnLabel') + '</a>'
        + '<button class="soft-btn bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5" onclick="window.showPreview(\'' + encodedFile + '\')">' + t('previewBtnLabel') + '</button>'
        + '<a class="soft-btn bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 text-xs px-3 py-1.5" href="' + buildAssetUrl('renderPdf', encodedFile) + '">' + t('pdfBtnLabel') + '</a>'
        + '<button class="soft-btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs px-3 py-1.5" onclick="window.deleteFile(\'' + encodedFile + '\')">' + t('deleteBtnLabel') + '</button>'
        + '</div>'
        + '</li>';
    }).join('');
  }

  async function fetchFileList() {
    if (!hasSecureFetchAccess()) {
      return fetch('/files/' + folderName);
    }

    return fetch(currentAccessCode ? '/secure/files/' + folderName + accessQuery() : '/secure/files/' + folderName, {
      headers: secureHeaders()
    });
  }

  async function loadFiles(showLoading) {
    if (showLoading || lastFileKeys === null) {
      filesStatus.classList.remove('hidden');
      filesStatus.textContent = t('filesLoading');
      filesList.classList.add('hidden');
    }

    try {
      const response = await fetchFileList();

      if (response.status === 401 || response.status === 403) {
        filesStatus.classList.remove('hidden');
        filesList.classList.add('hidden');
        filesList.innerHTML = '';
        filesStatus.textContent = t('filesUnauthorized');
        return;
      }

      if (!response.ok) throw new Error('Status ' + response.status);

      const data = await response.json();
      const files = data.files || [];
      const newKeys = JSON.stringify(files);

      if (newKeys === lastFileKeys) return;

      const previousFiles = lastFileKeys !== null ? JSON.parse(lastFileKeys) : [];
      lastFileKeys = newKeys;

      if (files.length === 0) {
        filesStatus.classList.remove('hidden');
        filesStatus.textContent = t('filesEmpty');
        filesList.classList.add('hidden');
        filesList.innerHTML = '';
        return;
      }

      filesStatus.classList.add('hidden');
      filesList.classList.remove('hidden');
      filesList.innerHTML = buildListMarkup(files, previousFiles);
    } catch (error) {
      if (showLoading || lastFileKeys === null) {
        filesStatus.classList.remove('hidden');
        filesStatus.textContent = t('filesError');
      }
      console.error('Load files error:', error);
    }
  }

  async function showPreview(encodedFileName) {
    const fileName = decodeURIComponent(encodedFileName);
    const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
    const previewUrl = buildAssetUrl('preview', encodedFileName);

    previewEmpty.classList.add('hidden');
    previewContent.classList.remove('hidden');
    previewContent.innerHTML = '<p class="text-sm text-zinc-500">' + t('previewLoading') + '</p>';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      previewContent.innerHTML = '<img src="' + previewUrl + '" alt="' + t('previewImageAlt') + '" class="w-full max-h-96 object-contain rounded-xl border border-zinc-100 bg-white">';
      return;
    }

    if (extension === 'pdf') {
      previewContent.innerHTML = '<iframe src="' + previewUrl + '" class="w-full h-96 rounded-xl border border-zinc-100 bg-white"></iframe>';
      return;
    }

    if (extension === 'txt') {
      try {
        const response = await fetch(buildAssetUrl('textPreview', encodedFileName), {
          headers: hasSecureAssetAccess() ? secureHeaders() : {}
        });
        if (!response.ok) throw new Error('Status ' + response.status);
        const text = await response.text();
        previewContent.innerHTML = '<pre class="text-xs text-zinc-700 whitespace-pre-wrap break-words">' + escapeHtml(text) + '</pre>';
      } catch (error) {
        previewContent.innerHTML = '<p class="text-sm text-red-700">' + t('previewTextError') + '</p>';
      }
      return;
    }

    previewContent.innerHTML = '<p class="text-sm text-zinc-700">' + t('previewUnsupported') + '</p>';
  }

  async function deleteFile(encodedFileName) {
    if (!window.confirm(t('deleteConfirm'))) return;

    try {
      if (!hasSecureFetchAccess()) {
        const publicResponse = await fetch('/delete/' + folderName + '/' + encodedFileName, { method: 'DELETE' });
        if (!publicResponse.ok) throw new Error('Status ' + publicResponse.status);
      } else {
        const secureResponse = await fetch(currentAccessCode ? '/secure/delete/' + folderName + '/' + encodedFileName + accessQuery() : '/secure/delete/' + folderName + '/' + encodedFileName, {
          method: 'DELETE',
          headers: secureHeaders()
        });
        if (!secureResponse.ok) throw new Error('Status ' + secureResponse.status);
      }

      lastFileKeys = null;
      await loadFiles(true);
    } catch (error) {
      window.alert(t('deleteError'));
      console.error('Delete error:', error);
    }
  }

  async function newSession() {
    try {
      if (!hasSecureFetchAccess()) {
        await fetch('/delete-all/' + folderName, { method: 'DELETE' });
      } else {
        await fetch(currentAccessCode ? '/secure/delete-all/' + folderName + accessQuery() : '/secure/delete-all/' + folderName, {
          method: 'DELETE',
          headers: secureHeaders()
        });
      }
    } catch (error) {
      console.error('Delete all error:', error);
    }

    localStorage.removeItem(uploaderTokenKey);
    currentAccessCode = '';

    const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const uploadUrl = window.location.origin + uploadPath + '?session=' + token;

    uploadLink.href = uploadUrl;
    setQrWithFallback(qrImage, uploadUrl);
    resetPreview();
    filesList.innerHTML = '';
    filesList.classList.add('hidden');
    filesStatus.classList.remove('hidden');
    filesStatus.textContent = t('filesLoading');
    lastFileKeys = null;

    await loadFiles(true);
  }

  const baseNewSession = newSession;
  const sessionTimeoutApi = window.createSessionTimeoutController({
    translate: t,
    restartSession: baseNewSession,
    minimumMs: 5 * 60 * 1000,
    responseMs: 60 * 1000
  });

  newSession = sessionTimeoutApi.wrapRestart(baseNewSession);
  window.showPreview = showPreview;
  window.deleteFile = deleteFile;

  document.getElementById('new-session-btn').addEventListener('click', newSession);
  finishButton.addEventListener('click', newSession);

  languageToggle.addEventListener('click', function () {
    currentLanguage = currentLanguage === 'nl' ? 'en' : 'nl';
    localStorage.setItem(languageKey, currentLanguage);
    applyLanguage();
    sessionTimeoutApi.refresh();
    lastFileKeys = null;
    loadFiles(true);
  });

  refreshButton.addEventListener('click', function () {
    lastFileKeys = null;
    loadFiles(true);
  });

  applyLanguage();
  setText('copy-hero-label', copyLabel);
  setText('uploads-subtitle', copyLabel);
  setQrCode();
  resetPreview();
  loadFiles(true);
  sessionTimeoutApi.start();
  window.setInterval(function () {
    loadFiles(false);
  }, 2500);
})();