(function () {
  const config = window.FDPFilesPageConfig;

  if (!config || !config.folderName || !config.uploadPath) {
    throw new Error('FDP files page config is missing.');
  }

  const folderName = config.folderName;
  const uploadPath = config.uploadPath;
  const downloadAllEnabled = config.enableDownloadAll === true;
  const productionUploadOrigin = config.productionUploadOrigin || 'https://fd-printing-uploads.onrender.com';
  const copyNumberMatch = folderName.match(/copy(\d+)/i);
  const copyNumber = copyNumberMatch ? copyNumberMatch[1] : '';
  const copyLabel = config.copyLabel || ('COPY ' + copyNumber);
  const uploaderTokenKey = config.uploaderTokenKey || ('fdp-uploader-' + folderName);
  const languageKey = 'fdp-lang';
  const currentParams = new URLSearchParams(window.location.search);

  const filesStatus = document.getElementById('files-status');
  const filesList = document.getElementById('files-list');
  const refreshButton = document.getElementById('refresh-files');
  const downloadAllButton = document.getElementById('download-all-files');
  const printAllButton = document.getElementById('print-all-files');
  const qrImage = document.getElementById('qr-image');
  const uploadLink = document.getElementById('upload-link');
  const finishButton = document.getElementById('finish-btn');
  const languageToggle = document.getElementById('language-toggle');
  const currentLangLabel = document.getElementById('current-lang');
  const previewEmpty = document.getElementById('preview-empty');
  const previewContent = document.getElementById('preview-content');
  const previewPrintButton = document.getElementById('preview-print-btn');
  const fallbackContainer = document.getElementById('fallback-container');
  const languagePanel = languageToggle ? languageToggle.parentElement : null;

  let currentLanguage = localStorage.getItem(languageKey) || 'nl';
  let currentAccessCode = currentParams.get('access') || '';
  let lastFileKeys = null;
  let currentPreviewEncodedFileName = null;
  let currentPreviewPdfObjectUrl = null;
  let currentFileNames = [];
  let activeHoverPreview = null;
  const hoverPreviewCache = new Map();

  const translations = {
    nl: {
      pageTitle: 'FD Printing Center - Bestanden {copyLabel}',
      langLabel: 'NL',
      stepLabel: 'Stap 1: Scan QR-code',
      quickAccessLabel: 'Snelle toegang',
      scanUploadText: 'Scan en upload bestand',
      openPriceListBtn: 'Prijslijst',
      closePriceListAria: 'Sluit prijslijst',
      uploadLinkText: 'Open uploadpagina {copyLabel}',
      newSessionBtn: 'Nieuwe sessie',
      newSessionConfirm: 'Weet je zeker dat je een nieuwe sessie wilt starten? Alle bestanden die je hebt geupload gaan verloren!',
      newSessionYes: 'Ja, starten',
      newSessionNo: 'Annuleren',
      refreshBtn: 'Ververs',
      downloadAllBtn: 'Download alles',
      printAllBtn: 'Alles printen',
      downloadAllEmptyError: 'Er zijn geen bestanden om te downloaden.',
      downloadAllError: 'Kon alle bestanden niet downloaden.',
      printAllError: 'Kon niet alles printen.',
      sessionDoneTitle: 'Ben je klaar met je sessie?',
      sessionDoneText: 'Als je klaar bent, wordt de sessie afgesloten en worden alle bestanden verwijderd.',
      sessionDoneYes: 'Ja',
      sessionDoneNo: 'Nee',
      sessionAutoResetText: 'Geen reactie ontvangen. De sessie wordt automatisch opnieuw gestart over',
      finishBtn: 'Klaar',
      finishNote: 'Klik op klaar wanneer je klaar bent om al je bestanden te verwijderen.',
      guideTitle: 'Handleiding',
      guideStep1: 'Scan de QR-code met je telefoon en open de link.',
      guideStep2: 'Tik op Selecteer bestand en upload je bestand.',
      guideStep3: 'Na het uploaden verschijnt het bestand automatisch op de computer waar de QR-code is gescand.',
      guideStep4: 'Je vindt het bestand in de uploadlijst aan de rechterkant.',
      guideTip: '<strong>Klik op Printen of Downloaden (optioneel: Voorbeeld om eerst te bekijken).</strong>',
      liveBadge: 'Live',
      uploadsTitle: 'Uploads',
      previewTitle: 'Bestandsvoorbeeld',
      previewSubtitle: 'Klik op Voorbeeld om de inhoud hier direct te zien.',
      previewEmpty: 'Nog geen voorbeeld geselecteerd.',
      priceModalTitle: 'Selfservice Printen en Kopieren',
      priceModalSubtitle: 'Duidelijke prijzen voor printen, kopieren en afwerken',
      priceStartupHeader: 'Opstart kosten / Hulp',
      priceStartupRow1: '<strong>Opstart kosten</strong><br><small>Incl. 5min. computergebruik.</small>',
      priceStartupRow2: '<strong>Opstart kosten</strong><br><small>Hulp van personeel</small>',
      priceBwHeader: 'Printen zwart-wit*',
      pricePerPageA4A3: 'Prijs per pagina - A4 en A3',
      priceAmountCol: 'Aantal',
      priceColorHeader: 'Printen in kleur*',
      priceOnRequest: 'Op aanvraag',
      pricePaperHeader: 'Dikker papier**',
      pricePerSheetA4A3: 'Toeslag per vel - A4 en A3',
      priceGramCol: 'Gram',
      pricePosterHeader: 'Posters 120 g mat',
      pricePerPosterBwColor: 'Prijs per poster - zwart-wit of kleur',
      priceSizeCol: 'Formaat',
      priceBwCol: 'zwart/wit',
      priceColorCol: 'kleur',
      pricePosterFootnote: 'Ander formaat nodig? Vraag een medewerker, we helpen je graag.',
      priceBindHeader: 'Inbinden (extra)',
      priceBindTrim: '<strong>Schoonsnijden</strong><br><small>Bij kleine oplage</small>',
      priceLaminateHeader: 'Lamineren**',
      priceLaminateCut: '<strong>Snijden per snede</strong>',
      priceScanHeader: 'Scannen*',
      priceFootnotePage: '<strong>* = prijs per pagina</strong>',
      priceFootnoteSheet: '<strong>** = prijs per vel</strong>',
      pricePrintWarning: 'Controleer je bestand goed. Fout geprinte pagina\'s worden wel berekend.',
      priceDownloadWarning: 'Download je bestand eerst op deze computer en start daarna met printen.',
      previewImageAlt: 'Voorbeeld van bestand',
      qrAltText: 'QR-code naar de uploadpagina van {copyLabel}',
      fallbackTitle: 'Alternatief als QR niet werkt',
      fallbackSubtext: 'Open een maildienst direct op je telefoon of laptop.',
      filesLoading: 'Bestanden laden...',
      filesEmpty: 'Nog geen bestanden geupload.',
      filesError: 'Kon bestanden niet laden.',
      filesUnauthorized: 'Deze prive-link is verlopen of niet meer geldig.',
      previewLoading: 'Voorbeeld laden...',
      previewUnsupported: 'Voor dit bestandstype is geen inline voorbeeld. Gebruik Download of PDF.',
      previewQuickUnsupported: 'Geen snel voorbeeld beschikbaar voor dit bestandstype.',
      previewTextError: 'Kon tekstvoorbeeld niet laden.',
      previewIconLabel: 'Voorbeeld van {fileName}',
      downloadBtnLabel: 'Download',
      downloadBtnShort: 'Down',
      previewBtnLabel: 'Voorbeeld',
      previewBtnShort: 'Prev',
      printBtnLabel: 'Print',
      printBtnShort: 'Print',
      editLayoutBtnLabel: 'Edit Layout',
      printConfirmStep1: 'Dit wordt geprint: {fileName}. Klopt dit voorbeeld?',
      printConfirmStep2: 'Definitief printen? Daarna opent het printervenster met instellingen.',
      pdfBtnLabel: 'PDF',
      deleteBtnLabel: 'Verwijderen',
      deleteBtnShort: 'Del',
      deleteConfirm: 'Weet je zeker dat je dit bestand wilt verwijderen?',
      deleteError: 'Kon bestand niet verwijderen.',
      fileBadgeNew: 'nieuw',
      fileBadgeReady: 'klaar'
    },
    en: {
      pageTitle: 'FD Printing Center - Files {copyLabel}',
      langLabel: 'EN',
      stepLabel: 'Step 1: Scan QR code',
      quickAccessLabel: 'Quick Access',
      scanUploadText: 'Scan and upload file',
      openPriceListBtn: 'Price List',
      closePriceListAria: 'Close price list',
      uploadLinkText: 'Open {copyLabel} upload page',
      newSessionBtn: 'New session',
      newSessionConfirm: 'Are you sure you want to start a new session? All uploaded files will be lost!',
      newSessionYes: 'Yes, start',
      newSessionNo: 'Cancel',
      refreshBtn: 'Refresh',
      downloadAllBtn: 'Download all',
      printAllBtn: 'Print all',
      downloadAllEmptyError: 'There are no files to download.',
      downloadAllError: 'Could not download all files.',
      printAllError: 'Could not print all files.',
      sessionDoneTitle: 'Are you done with your session?',
      sessionDoneText: 'If you are finished, the session will end and all files will be deleted.',
      sessionDoneYes: 'Yes',
      sessionDoneNo: 'No',
      sessionAutoResetText: 'No response received. The session will automatically restart in',
      finishBtn: 'Finish',
      finishNote: 'Click finish when you are done to delete all your files.',
      guideTitle: 'Instructions:',
      guideStep1: '1. Scan the QR code on the right or open the {copyLabel} upload page.',
      guideStep2: '2. Upload your file from your phone, tablet, or laptop.',
      guideStep3: '3. Wait until the file appears below in the uploads list.',
      guideStep4: '4. Click Preview or Download to open the file.',
      guideTip: '<strong>Tip:</strong> You can render the file to PDF before downloading it.',
      liveBadge: 'Live',
      uploadsTitle: 'Uploads',
      previewTitle: 'File preview',
      previewSubtitle: 'Click Preview to see the file content here instantly.',
      previewEmpty: 'No preview selected yet.',
      priceModalTitle: 'Self-service Printing and Copying',
      priceModalSubtitle: 'Clear prices for printing, copying, and finishing',
      priceStartupHeader: 'Startup costs / Assistance',
      priceStartupRow1: '<strong>Startup costs</strong><br><small>Includes 5 minutes of computer use.</small>',
      priceStartupRow2: '<strong>Startup costs</strong><br><small>Assistance from staff</small>',
      priceBwHeader: 'Black-and-white printing*',
      pricePerPageA4A3: 'Price per page - A4 and A3',
      priceAmountCol: 'Quantity',
      priceColorHeader: 'Color printing*',
      priceOnRequest: 'On request',
      pricePaperHeader: 'Heavier paper**',
      pricePerSheetA4A3: 'Surcharge per sheet - A4 and A3',
      priceGramCol: 'Weight (g)',
      pricePosterHeader: 'Posters 120 g matte',
      pricePerPosterBwColor: 'Price per poster - black-and-white or color',
      priceSizeCol: 'Size',
      priceBwCol: 'black and white',
      priceColorCol: 'color',
      pricePosterFootnote: 'Need another size? Ask a staff member, we are happy to help.',
      priceBindHeader: 'Binding (extra)',
      priceBindTrim: '<strong>Edge trimming</strong><br><small>For small print runs</small>',
      priceLaminateHeader: 'Lamination**',
      priceLaminateCut: '<strong>Cutting per cut</strong>',
      priceScanHeader: 'Scanning*',
      priceFootnotePage: '<strong>* = price per page</strong>',
      priceFootnoteSheet: '<strong>** = price per sheet</strong>',
      pricePrintWarning: 'Please check your file carefully. Misprinted pages will still be charged.',
      priceDownloadWarning: 'First download your file on this computer, then start printing.',
      previewImageAlt: 'File preview',
      qrAltText: 'QR code to the {copyLabel} upload page',
      fallbackTitle: 'Alternative if QR does not work',
      fallbackSubtext: 'Open a mail service directly on your phone or laptop.',
      filesLoading: 'Loading files...',
      filesEmpty: 'No files uploaded yet.',
      filesError: 'Could not load files.',
      filesUnauthorized: 'This private link has expired or is no longer valid.',
      previewLoading: 'Loading preview...',
      previewUnsupported: 'Inline preview is not available for this file type. Use Download or PDF.',
      previewQuickUnsupported: 'Quick preview is not available for this file type.',
      previewTextError: 'Could not load text preview.',
      previewIconLabel: 'Preview of {fileName}',
      downloadBtnLabel: 'Download',
      downloadBtnShort: 'Down',
      previewBtnLabel: 'Preview',
      previewBtnShort: 'Prev',
      printBtnLabel: 'Print',
      printBtnShort: 'Print',
      editLayoutBtnLabel: 'Edit Layout',
      printConfirmStep1: 'This will be printed: {fileName}. Is this preview correct?',
      printConfirmStep2: 'Print now? The printer settings dialog will open next.',
      pdfBtnLabel: 'PDF',
      deleteBtnLabel: 'Delete',
      deleteBtnShort: 'Del',
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

  function getUploaderToken() {
    let token = localStorage.getItem(uploaderTokenKey);
    if (token) return token;

    if (window.crypto && window.crypto.randomUUID) {
      token = window.crypto.randomUUID() + '-' + Date.now();
    } else {
      token = 'tok-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    localStorage.setItem(uploaderTokenKey, token);
    return token;
  }

  function secureHeaders() {
    const uploaderToken = getStoredUploaderToken();
    return uploaderToken ? { 'x-uploader-token': uploaderToken } : {};
  }

  function buildUploadUrl(accessCode = '') {
    const baseUrl = getUploadOrigin() + uploadPath;
    return accessCode ? baseUrl + '?access=' + encodeURIComponent(accessCode) : baseUrl;
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

  function setAttr(id, name, value) {
    const element = document.getElementById(id);
    if (element) element.setAttribute(name, value);
  }

  function buildBrandButton(label, href, domain, iconMarkup) {
    const iconUrl = domain ? 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(domain) : '';
    const iconContent = iconMarkup || ('<img src="' + iconUrl + '" alt="" aria-hidden="true" class="block h-full w-full object-contain">');
    return [
      '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="inline-flex w-max items-center justify-center gap-1 rounded-full border border-white/70 bg-white/95 px-2 py-1 text-[11px] font-bold leading-none text-zinc-800 shadow-lg hover:bg-white hover:-translate-y-0.5 transition whitespace-nowrap">',
      '<span class="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-sm">',
      iconContent,
      '</span>',
      '<span class="whitespace-nowrap leading-none">' + escapeHtml(label) + '</span>',
      '</a>'
    ].join('');
  }

  function whatsappIcon() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="block h-full w-full" fill="none">',
      '<path d="M12 2.75c-5.1 0-9.25 4.03-9.25 8.98 0 1.71.49 3.38 1.42 4.83L3.1 21.25l4.9-1.56a9.43 9.43 0 0 0 4 .88c5.1 0 9.25-4.03 9.25-8.98s-4.15-8.84-9.25-8.84Z" fill="#25D366"/>',
      '<path d="M8.6 7.95c-.22-.5-.46-.51-.67-.52h-.57c-.2 0-.52.08-.79.37-.27.3-1.04 1-1.04 2.44s1.07 2.82 1.22 3.02c.15.2 2.07 3.26 5.1 4.44 2.52.98 3.04.79 3.59.74.55-.05 1.78-.72 2.03-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35-.3-.15-1.78-.9-2.06-1-.27-.1-.47-.15-.67.15-.2.3-.77 1- .95 1.2-.17.2-.35.22-.65.07-.3-.15-1.28-.46-2.43-1.47-.9-.8-1.5-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.66-1.64-.91-2.24Z" fill="#ffffff"/>',
      '</svg>'
    ].join('');
  }

  function yahooIcon() {
    return [
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="block h-full w-full" fill="none">',
      '<rect x="2" y="2" width="20" height="20" rx="5" fill="#6001D2"/>',
      '<path d="M8.15 7.25h2.4l1.8 3.38 1.82-3.38h2.34l-3.08 5.18v4.32h-2.2v-4.32L8.15 7.25Zm8.73 0h2.02l-.47 7.03h-1.08l-.47-7.03Zm-.08 8.1h2.18v2.1H16.8v-2.1Z" fill="#ffffff"/>',
      '</svg>'
    ].join('');
  }

  function ensureFallbackButtons() {
    if (!fallbackContainer || document.getElementById('qr-fallback-links')) {
      return;
    }

    const fallbackBlock = document.createElement('div');
    fallbackBlock.id = 'qr-fallback-links';
    fallbackBlock.className = 'inline-flex flex-col items-center gap-1 bg-white/95 rounded-2xl border border-white/70 px-3 py-2 shadow-lg';
    fallbackBlock.innerHTML = [
      '<div class="flex flex-row flex-wrap items-center justify-center gap-1.5">',
      buildBrandButton('Gmail', 'https://mail.google.com/', 'mail.google.com'),
      buildBrandButton('Hotmail', 'https://outlook.live.com/mail/', 'outlook.live.com'),
      buildBrandButton('Temp Mail', 'https://temp-mail.org/', 'temp-mail.org'),
      buildBrandButton('WhatsApp', 'https://web.whatsapp.com', '', whatsappIcon()),
      buildBrandButton('Yahoo Mail', 'https://mail.yahoo.com', '', yahooIcon()),
      '</div>',
      '</div>'
    ].join('');

    fallbackContainer.appendChild(fallbackBlock);
  }

  function fillTemplate(template, variables) {
    let value = template;
    Object.keys(variables).forEach(function (key) {
      value = value.replaceAll('{' + key + '}', String(variables[key]));
    });
    return value;
  }

  function applyLanguage() {
    currentLangLabel.textContent = t('langLabel');
    setText('step-label', t('stepLabel'));
    setText('quick-access-label', t('quickAccessLabel'));
    setText('scan-upload-text', t('scanUploadText'));
    setText('openPrijzenBtn', t('openPriceListBtn'));
    setAttr('prijzen-close-btn', 'aria-label', t('closePriceListAria'));
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
    setText('download-all-files', t('downloadAllBtn'));
    setText('print-all-files', t('printAllBtn'));
    setText('fallback-title', t('fallbackTitle'));
    setText('fallback-subtext', t('fallbackSubtext'));
    setText('finish-btn', t('finishBtn'));
    setText('finish-note', t('finishNote'));
    setText('preview-title', t('previewTitle'));
    setText('preview-subtitle', t('previewSubtitle'));
    setText('edit-layout-btn', t('editLayoutBtnLabel'));
    setText('prijzenModalTitle', t('priceModalTitle'));
    setText('prijzen-subtitle', t('priceModalSubtitle'));
    setText('prijzen-startup-header', t('priceStartupHeader'));
    setHtml('prijzen-startup-row-1', t('priceStartupRow1'));
    setHtml('prijzen-startup-row-2', t('priceStartupRow2'));
    setHtml('prijzen-bw-header', t('priceBwHeader') + ' <span id="prijzen-bw-sub" class="subheader-text">' + t('pricePerPageA4A3') + '</span>');
    setText('prijzen-bw-col-amount', t('priceAmountCol'));
    setHtml('prijzen-color-header', t('priceColorHeader') + ' <span id="prijzen-color-sub" class="subheader-text">' + t('pricePerPageA4A3') + '</span>');
    setText('prijzen-color-col-amount', t('priceAmountCol'));
    setText('prijzen-color-on-request', t('priceOnRequest'));
    setHtml('prijzen-paper-header', t('pricePaperHeader') + ' <span id="prijzen-paper-sub" class="subheader-text">' + t('pricePerSheetA4A3') + '</span>');
    setText('prijzen-paper-col-gram', t('priceGramCol'));
    setHtml('prijzen-poster-header', t('pricePosterHeader') + ' <span id="prijzen-poster-sub" class="subheader-text">' + t('pricePerPosterBwColor') + '</span>');
    setText('prijzen-poster-col-size', t('priceSizeCol'));
    setText('prijzen-poster-col-bw', t('priceBwCol'));
    setText('prijzen-poster-col-color', t('priceColorCol'));
    setText('prijzen-poster-footnote', t('pricePosterFootnote'));
    setText('prijzen-bind-header', t('priceBindHeader'));
    setHtml('prijzen-bind-trim', t('priceBindTrim'));
    setText('prijzen-laminate-header', t('priceLaminateHeader'));
    setHtml('prijzen-laminate-cut', t('priceLaminateCut'));
    setText('prijzen-scan-header', t('priceScanHeader'));
    setHtml('prijzen-footnote-page', t('priceFootnotePage'));
    setHtml('prijzen-footnote-sheet', t('priceFootnoteSheet'));
    setText('prijzen-print-warning', t('pricePrintWarning'));
    setText('prijzen-download-warning', t('priceDownloadWarning'));
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
    const absoluteUploadUrl = buildUploadUrl(currentAccessCode);
    if (uploadLink) {
      uploadLink.href = absoluteUploadUrl;
    }
    setQrWithFallback(qrImage, absoluteUploadUrl);
  }

  async function createSessionAccessCode() {
    const response = await fetch('/secure/access-link/' + folderName, {
      method: 'POST',
      headers: { 'x-uploader-token': getUploaderToken() }
    });

    if (!response.ok) {
      throw new Error('Status ' + response.status);
    }

    const data = await response.json();
    if (!data || !data.accessCode) {
      throw new Error('No access code returned');
    }

    return data.accessCode;
  }

  function getUploadOrigin() {
    if (typeof config.uploadOrigin === 'string' && config.uploadOrigin) {
      return config.uploadOrigin.replace(/\/$/, '');
    }

    if (window.location && /^https?:/i.test(window.location.origin || '')) {
      return window.location.origin.replace(/\/$/, '');
    }

    return productionUploadOrigin;
  }

  function resetPreview() {
    if (currentPreviewPdfObjectUrl) {
      URL.revokeObjectURL(currentPreviewPdfObjectUrl);
      currentPreviewPdfObjectUrl = null;
    }
    previewContent.innerHTML = '';
    previewContent.classList.add('hidden');
    previewEmpty.classList.remove('hidden');
    previewEmpty.textContent = t('previewEmpty');
    currentPreviewEncodedFileName = null;
    if (previewPrintButton) {
      previewPrintButton.disabled = true;
      previewPrintButton.classList.add('opacity-50', 'cursor-not-allowed');
      previewPrintButton.classList.remove('hover:bg-emerald-500');
    }
  }

  function scrollToPreviewSection() {
    const previewTitle = document.getElementById('preview-title');
    const previewSection = previewTitle ? previewTitle.closest('section') : null;
    const target = previewSection || previewContent;

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function fileStatusBadge(isNew) {
    if (isNew) {
      return '<span class="shrink-0 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-xs font-bold text-red-700">' + t('fileBadgeNew') + '</span>';
    }
    return '<span class="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">' + t('fileBadgeReady') + '</span>';
  }

  function buildAssetUrl(type, encodedFileName) {
    return {
      download: '/download/' + folderName + '/' + encodedFileName,
      preview: '/preview/' + folderName + '/' + encodedFileName,
      textPreview: '/text-preview/' + folderName + '/' + encodedFileName,
      renderPdf: '/render-pdf/' + folderName + '/' + encodedFileName
    }[type];
  }

  function buildInlinePdfUrl(encodedFileName) {
    return buildAssetUrl('renderPdf', encodedFileName) + '?inline=1';
  }

  async function getPdfBlobUrl(encodedFileName) {
    const pdfResponse = await fetch(buildInlinePdfUrl(encodedFileName), {
      headers: hasSecureAssetAccess() ? secureHeaders() : {}
    });

    if (!pdfResponse.ok) {
      throw new Error('Status ' + pdfResponse.status);
    }

    const pdfBlob = await pdfResponse.blob();
    return URL.createObjectURL(pdfBlob);
  }

  function fileExtensionFromName(fileName) {
    return fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getHoverPreviewMarkup(encodedFileName, fileName, textContent) {
    const extension = fileExtensionFromName(fileName);

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif'].includes(extension)) {
      return '<img src="' + buildAssetUrl('preview', encodedFileName) + '" alt="' + escapeHtml(fileName) + '" class="preview-media">';
    }

    if (extension === 'pdf') {
      return '<iframe src="' + buildAssetUrl('preview', encodedFileName) + '#toolbar=0&navpanes=0&scrollbar=0&page=1" class="preview-pdf" loading="lazy"></iframe>';
    }

    if (extension === 'txt') {
      return '<pre class="preview-text">' + escapeHtml(textContent || '') + '</pre>';
    }

    return '<div class="preview-unsupported">' + t('previewQuickUnsupported') + '</div>';
  }

  async function ensureHoverPreviewContent(popover, encodedFileName, fileName) {
    const cacheKey = encodedFileName;

    if (hoverPreviewCache.has(cacheKey)) {
      popover.innerHTML = hoverPreviewCache.get(cacheKey);
      return;
    }

    popover.innerHTML = '<div class="preview-loading-placeholder">' + t('previewLoading') + '</div>';

    let textContent = '';
    const extension = fileExtensionFromName(fileName);

    if (extension === 'txt') {
      try {
        const response = await fetch(buildAssetUrl('textPreview', encodedFileName), {
          headers: hasSecureAssetAccess() ? secureHeaders() : {}
        });
        if (response.ok) {
          textContent = await response.text();
        }
      } catch (error) {
        textContent = '';
      }
    }

    const html = getHoverPreviewMarkup(encodedFileName, fileName, textContent);
    hoverPreviewCache.set(cacheKey, html);

    if (popover) {
      popover.innerHTML = html;
    }
  }

  function stopHoverPreviewAnimation(state) {
    if (!state || !state.rafId) return;
    window.cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  function hideActiveHoverPreview() {
    if (!activeHoverPreview) return;

    activeHoverPreview.popover.classList.remove('is-visible');
    activeHoverPreview.popover.setAttribute('aria-hidden', 'true');
    stopHoverPreviewAnimation(activeHoverPreview);
    activeHoverPreview = null;
  }

  function updateHoverPreviewTarget(state, event) {
    if (!state || !event) return;

    const width = state.popover.offsetWidth || 320;
    const height = state.popover.offsetHeight || 232;
    const padding = 14;

    const targetX = clamp(event.clientX + 22, padding, window.innerWidth - width - padding);
    const targetY = clamp(event.clientY - (height * 0.38), padding, window.innerHeight - height - padding);

    state.targetX = targetX;
    state.targetY = targetY;
  }

  function startHoverPreviewAnimation(state) {
    if (!state || state.rafId) return;

    function step() {
      state.currentX += (state.targetX - state.currentX) * 0.2;
      state.currentY += (state.targetY - state.currentY) * 0.2;

      state.popover.style.setProperty('--preview-x', state.currentX.toFixed(2) + 'px');
      state.popover.style.setProperty('--preview-y', state.currentY.toFixed(2) + 'px');

      state.rafId = window.requestAnimationFrame(step);
    }

    state.rafId = window.requestAnimationFrame(step);
  }

  function showHoverPreview(item, event) {
    if (!item) return;

    const popover = item.querySelector('.file-preview-popover');
    const encodedFileName = item.getAttribute('data-encoded-file') || '';
    const fileName = item.getAttribute('data-file-name') || '';

    if (!popover || !encodedFileName || !fileName) return;

    if (activeHoverPreview && activeHoverPreview.item !== item) {
      hideActiveHoverPreview();
    }

    if (!activeHoverPreview) {
      const initialX = event ? event.clientX + 18 : 0;
      const initialY = event ? event.clientY - 24 : 0;

      activeHoverPreview = {
        item: item,
        popover: popover,
        currentX: initialX,
        currentY: initialY,
        targetX: initialX,
        targetY: initialY,
        rafId: null
      };

      popover.style.setProperty('--preview-x', initialX + 'px');
      popover.style.setProperty('--preview-y', initialY + 'px');
      popover.classList.add('is-visible');
      popover.setAttribute('aria-hidden', 'false');

      startHoverPreviewAnimation(activeHoverPreview);
      ensureHoverPreviewContent(popover, encodedFileName, fileName);
    }

    updateHoverPreviewTarget(activeHoverPreview, event);
  }

  function bindHoverPreviewInteractions() {
    const items = filesList.querySelectorAll('.upload-item');

    items.forEach(function (item) {
      const trigger = item.querySelector('.preview-trigger-icon');

      item.addEventListener('mouseenter', function (event) {
        showHoverPreview(item, event);
      });

      item.addEventListener('mousemove', function (event) {
        if (activeHoverPreview && activeHoverPreview.item === item) {
          updateHoverPreviewTarget(activeHoverPreview, event);
          return;
        }
        showHoverPreview(item, event);
      });

      item.addEventListener('mouseleave', function () {
        if (activeHoverPreview && activeHoverPreview.item === item) {
          hideActiveHoverPreview();
        }
      });

      if (trigger) {
        trigger.addEventListener('focus', function () {
          const rect = trigger.getBoundingClientRect();
          showHoverPreview(item, {
            clientX: rect.left + rect.width,
            clientY: rect.top + (rect.height / 2)
          });
        });

        trigger.addEventListener('blur', function () {
          if (activeHoverPreview && activeHoverPreview.item === item) {
            hideActiveHoverPreview();
          }
        });
      }
    });
  }

  function buildListMarkup(files, previousFiles) {
    function responsiveActionLabel(fullLabelKey, shortLabelKey) {
      const fullLabel = t(fullLabelKey);
      const shortLabel = t(shortLabelKey) || fullLabel;
      return '<span class="action-label-full">' + fullLabel + '</span><span class="action-label-short">' + shortLabel + '</span>';
    }

    const newFileSet = new Set(files.filter(function (fileName) {
      return previousFiles.indexOf(fileName) === -1;
    }));

    return files.map(function (fileName) {
      const safeName = escapeHtml(fileName);
      const encodedFile = encodeURIComponent(fileName);
      const isNew = newFileSet.has(fileName) && previousFiles.length > 0;
      const previewLabel = escapeHtml(fillTemplate(t('previewIconLabel'), { fileName: fileName }));
      const printIcon = '<span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><rect x="4" y="9" width="16" height="8" rx="2" stroke="currentColor" stroke-width="1.8"></rect><path d="M7 14h10v7H7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg></span>';
      const downloadIcon = '<span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 4v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="m8 10 4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg></span>';
      const pdfIcon = '<span class="action-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13H7z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M14 3v5h5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path><path d="M10 16h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg></span>';

      return '<li class="upload-item rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm' + (isNew ? ' new-file-highlight' : '') + '" data-file-name="' + safeName + '" data-encoded-file="' + encodedFile + '">'
        + '<div class="flex items-start justify-between gap-2 mb-2">'
        + '<div class="file-info">'
        + '<button type="button" class="preview-trigger-icon" aria-label="' + previewLabel + '">'
        + '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12 18.7 18.5 12 18.5 1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.8"></circle></svg>'
        + '</button>'
        + '<div class="file-name">' + safeName + '</div>'
        + '</div>'
        + fileStatusBadge(isNew)
        + '</div>'
        + '<div class="file-actions-row">'
        + '<button class="soft-btn file-action-btn bg-emerald-600 hover:bg-emerald-500 text-white" onclick="window.startPrintFlow(\'' + encodedFile + '\')">' + printIcon + responsiveActionLabel('printBtnLabel', 'printBtnShort') + '</button>'
        + '<a class="soft-btn file-action-btn bg-red-600 hover:bg-red-500 text-white" href="' + buildAssetUrl('download', encodedFile) + '">' + downloadIcon + responsiveActionLabel('downloadBtnLabel', 'downloadBtnShort') + '</a>'
        + '<button class="soft-btn file-action-btn bg-zinc-800 hover:bg-zinc-700 text-white" onclick="window.showPreview(\'' + encodedFile + '\')">' + responsiveActionLabel('previewBtnLabel', 'previewBtnShort') + '</button>'
        + '<a class="soft-btn file-action-btn bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200" href="' + buildAssetUrl('renderPdf', encodedFile) + '">' + pdfIcon + t('pdfBtnLabel') + '</a>'
        + '<button class="soft-btn file-action-btn bg-red-50 hover:bg-red-100 text-red-700 border border-red-200" onclick="window.deleteFile(\'' + encodedFile + '\')">' + responsiveActionLabel('deleteBtnLabel', 'deleteBtnShort') + '</button>'
        + '</div>'
        + '<div class="file-preview-popover" aria-hidden="true">'
        + '<div class="preview-loading-placeholder">' + t('previewLoading') + '</div>'
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

  async function fetchPublicFileList() {
    return fetch('/files/' + folderName);
  }

  function downloadFilenameFromHeaders(headers) {
    const disposition = headers.get('content-disposition') || '';
    const matches = disposition.match(/filename="?([^";]+)"?/i);
    if (matches && matches[1]) return matches[1];
    return folderName + '-files.pdf';
  }

  async function fetchBulkWithFallback(securePath, publicPath) {
    if (hasSecureFetchAccess()) {
      try {
        const secureResponse = await fetch(securePath, {
          headers: secureHeaders()
        });

        if (secureResponse.ok) {
          return secureResponse;
        }

        console.warn('Secure bulk endpoint returned status', secureResponse.status, 'falling back to public endpoint.');
      } catch (error) {
        console.warn('Secure bulk endpoint failed, trying public endpoint.', error);
      }
    }

    return fetch(publicPath);
  }

  async function downloadAllFiles() {
    if (!downloadAllButton) return;

    downloadAllButton.disabled = true;
    try {
      const response = await fetchBulkWithFallback(
        '/secure/download-all/' + folderName + accessQuery(),
        '/download-all/' + folderName
      );

      if (response.status === 404) {
        window.alert(t('downloadAllEmptyError'));
        return;
      }

      if (!response.ok) throw new Error('Status ' + response.status);

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = folderName + '-files.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.alert(t('downloadAllError'));
      console.error('Download all error:', error);
    } finally {
      downloadAllButton.disabled = false;
    }
  }

  async function printAllFiles() {
    if (!printAllButton) return;

    printAllButton.disabled = true;
    try {
      const response = await fetchBulkWithFallback(
        '/secure/download-all-pdf/' + folderName + accessQuery(),
        '/download-all-pdf/' + folderName
      );

      if (response.status === 404) {
        window.alert(t('downloadAllEmptyError'));
        return;
      }

      if (!response.ok) throw new Error('Status ' + response.status);

      const blob = await response.blob();
      const pdfObjectUrl = URL.createObjectURL(blob);
      const printWindow = window.open(pdfObjectUrl, '_blank');

      if (printWindow) {
        printWindow.focus();
        setTimeout(function () {
          try {
            printWindow.print();
          } catch (error) {
            console.error('Print all error:', error);
          } finally {
            URL.revokeObjectURL(pdfObjectUrl);
          }
        }, 700);
      } else {
        URL.revokeObjectURL(pdfObjectUrl);
      }
    } catch (error) {
      window.alert(t('printAllError'));
      console.error('Print all error:', error);
    } finally {
      printAllButton.disabled = false;
    }
  }

  async function loadFiles(showLoading) {
    if (showLoading || lastFileKeys === null) {
      filesStatus.classList.remove('hidden');
      filesStatus.textContent = t('filesLoading');
      filesList.classList.add('hidden');
    }

    try {
      const response = await fetchPublicFileList();

      if (!response.ok) throw new Error('Status ' + response.status);

      const data = await response.json();
      const files = data.files || [];
      currentFileNames = files.slice();
      const newKeys = JSON.stringify(files);

      if (newKeys === lastFileKeys) return;

      const previousFiles = lastFileKeys !== null ? JSON.parse(lastFileKeys) : [];
      lastFileKeys = newKeys;

      if (files.length === 0) {
        hideActiveHoverPreview();
        filesStatus.classList.remove('hidden');
        filesStatus.textContent = t('filesEmpty');
        filesList.classList.add('hidden');
        filesList.innerHTML = '';
        return;
      }

      filesStatus.classList.add('hidden');
      filesList.classList.remove('hidden');
      filesList.innerHTML = buildListMarkup(files, previousFiles);
      bindHoverPreviewInteractions();
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
    const showAsPdf = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif'].includes(extension);

    scrollToPreviewSection();

    currentPreviewEncodedFileName = encodedFileName;
    if (typeof window.setImpositionActiveFile === 'function') {
      window.setImpositionActiveFile(encodedFileName);
    }

    if (typeof window.loadFileIntoImpositionPreview === 'function') {
      window.loadFileIntoImpositionPreview(previewUrl);
    }

    if (previewPrintButton) {
      previewPrintButton.disabled = false;
      previewPrintButton.classList.remove('opacity-50', 'cursor-not-allowed');
      previewPrintButton.classList.add('hover:bg-emerald-500');
    }

    previewEmpty.classList.add('hidden');
    previewContent.classList.remove('hidden');
    previewContent.innerHTML = '<p class="text-sm text-zinc-500">' + t('previewLoading') + '</p>';

    const printAction = '<div class="flex justify-end mb-3">'
      + '<button class="soft-btn bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5" onclick="window.startPrintFlow(\'' + encodedFileName + '\')">'
      + t('printBtnLabel')
      + '</button>'
      + '</div>';

    if (showAsPdf) {
      try {
        if (currentPreviewPdfObjectUrl) {
          URL.revokeObjectURL(currentPreviewPdfObjectUrl);
          currentPreviewPdfObjectUrl = null;
        }

        currentPreviewPdfObjectUrl = await getPdfBlobUrl(encodedFileName);
        previewContent.innerHTML = printAction
          + '<iframe src="' + currentPreviewPdfObjectUrl + '" class="w-full h-96 rounded-xl border border-zinc-100 bg-white"></iframe>';
      } catch (error) {
        previewContent.innerHTML = '<p class="text-sm text-red-700">' + t('filesError') + '</p>';
      }
      return;
    }

    if (extension === 'pdf') {
      previewContent.innerHTML = printAction
        + '<iframe src="' + previewUrl + '" class="w-full h-96 rounded-xl border border-zinc-100 bg-white"></iframe>';
      return;
    }

    if (extension === 'txt') {
      try {
        const response = await fetch(buildAssetUrl('textPreview', encodedFileName), {
          headers: hasSecureAssetAccess() ? secureHeaders() : {}
        });
        if (!response.ok) throw new Error('Status ' + response.status);
        const text = await response.text();
        previewContent.innerHTML = printAction
          + '<pre class="text-xs text-zinc-700 whitespace-pre-wrap break-words">' + escapeHtml(text) + '</pre>';
      } catch (error) {
        previewContent.innerHTML = '<p class="text-sm text-red-700">' + t('previewTextError') + '</p>';
      }
      return;
    }

    previewContent.innerHTML = '<p class="text-sm text-zinc-700">' + t('previewUnsupported') + '</p>';
    currentPreviewEncodedFileName = null;
    if (previewPrintButton) {
      previewPrintButton.disabled = true;
      previewPrintButton.classList.add('opacity-50', 'cursor-not-allowed');
      previewPrintButton.classList.remove('hover:bg-emerald-500');
    }
  }

  async function printPreview(encodedFileName) {
    function resolveImpositionPreset(presetId) {
      const presets = {
        full: { cols: 1, rows: 1, centered: false, tileScale: 1 },
        p10x15: { cols: 1, rows: 2, centered: false, tileScale: 1 },
        p13x18: { cols: 2, rows: 1, centered: false, tileScale: 1 },
        p20x25: { cols: 1, rows: 1, centered: true, tileScale: 0.82 },
        p9x13: { cols: 2, rows: 2, centered: false, tileScale: 1 },
        wallet: { cols: 3, rows: 3, centered: false, tileScale: 1 }
      };

      return presets[presetId] || null;
    }

    function resolveImpositionSettings(targetEncodedFileName) {
      const settings = window.FDPImpositionSettings;
      if (!settings || typeof settings !== 'object') return null;
      if (!settings.encodedFileName || settings.encodedFileName !== targetEncodedFileName) return null;

      const preset = resolveImpositionPreset(settings.presetId);
      if (!preset) return null;

      const imageUrl = typeof settings.imageUrl === 'string' ? settings.imageUrl : '';
      if (!imageUrl || !/\.(png|jpe?g|gif|webp|bmp|tiff?|avif|heic|heif)(\?|$)/i.test(imageUrl)) return null;

      const copies = clamp(Number.parseInt(settings.copies, 10) || 1, 1, 200);
      const fitToFrame = settings.fitToFrame !== false;
      const paperSize = settings.paperSize === 'A3' ? 'A3' : 'A4';
      const orientation = settings.orientation === 'landscape' ? 'landscape' : 'portrait';

      return {
        imageUrl,
        copies,
        fitToFrame,
        paperSize,
        orientation,
        preset,
        label: settings.presetLabel || settings.presetId || 'Layout'
      };
    }

    function buildImpositionSheetMarkup(layout) {
      const totalSlots = layout.preset.cols * layout.preset.rows;
      let cells = '';

      for (let index = 0; index < totalSlots; index += 1) {
        const tileStyle = layout.preset.centered
          ? 'width:' + Math.round(layout.preset.tileScale * 100) + '%;height:' + Math.round(layout.preset.tileScale * 100) + '%;'
          : 'width:100%;height:100%;';

        cells += '<div class="slot-wrap">'
          + '<div class="slot" style="' + tileStyle + '">'
          + '<img src="' + escapeHtml(layout.imageUrl) + '" alt="Imposition image" style="object-fit:' + (layout.fitToFrame ? 'cover' : 'contain') + ';">'
          + '</div>'
          + '</div>';
      }

      return '<div class="sheet-grid" style="grid-template-columns:repeat(' + layout.preset.cols + ',1fr);grid-template-rows:repeat(' + layout.preset.rows + ',1fr);">'
        + cells
        + '</div>';
    }

    function printImpositionLayout(layout) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return false;

      const isA3 = layout.paperSize === 'A3';
      const shortEdgeMm = isA3 ? 297 : 210;
      const longEdgeMm = isA3 ? 420 : 297;
      const isLandscape = layout.orientation === 'landscape';
      const sheetDimensions = {
        width: (isLandscape ? longEdgeMm : shortEdgeMm) + 'mm',
        height: (isLandscape ? shortEdgeMm : longEdgeMm) + 'mm'
      };

      let pagesMarkup = '';
      for (let pageIndex = 0; pageIndex < layout.copies; pageIndex += 1) {
        pagesMarkup += '<section class="print-page">'
          + '<div class="sheet" style="width:' + sheetDimensions.width + ';height:' + sheetDimensions.height + ';">'
          + buildImpositionSheetMarkup(layout)
          + '</div>'
          + '</section>';
      }

      const html = '<!doctype html><html><head><title>Print Layout</title>'
        + '<style>'
        + '@page{size:' + layout.paperSize + ' ' + layout.orientation + ';margin:0;}'
        + 'html,body{margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;}'
        + '.print-page{min-height:100vh;display:flex;align-items:center;justify-content:center;page-break-after:always;padding:8mm;box-sizing:border-box;}'
        + '.print-page:last-child{page-break-after:auto;}'
        + '.sheet{background:#fff;box-shadow:0 0 0 1px rgba(15,23,42,.18);padding:6mm;box-sizing:border-box;display:block;}'
        + '.sheet-grid{width:100%;height:100%;display:grid;gap:2.5mm;}'
        + '.slot-wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;}'
        + '.slot{overflow:hidden;border:1px solid #d4d4d8;background:#fafafa;}'
        + '.slot img{display:block;width:100%;height:100%;}'
        + '@media print{html,body{background:#fff;} .print-page{padding:0;min-height:auto;align-items:flex-start;justify-content:center;} .sheet{box-shadow:none;}}'
        + '</style></head><body>'
        + pagesMarkup
        + '<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},250);});</script>'
        + '</body></html>';

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return true;
    }

    const impositionLayout = resolveImpositionSettings(encodedFileName);
    if (impositionLayout) {
      const usedLayoutPrinter = printImpositionLayout(impositionLayout);
      if (usedLayoutPrinter) {
        return;
      }
    }

    const fileName = decodeURIComponent(encodedFileName);
    const extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'avif', 'pdf'].includes(extension)) {
      const shouldConvertToPdf = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'avif', 'heic', 'heif'].includes(extension);
      const printableUrl = shouldConvertToPdf
        ? (currentPreviewPdfObjectUrl || await getPdfBlobUrl(encodedFileName))
        : buildAssetUrl('preview', encodedFileName);
      const printWindow = window.open(printableUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
        setTimeout(function () {
          try {
            printWindow.print();
          } catch (error) {
            console.error('Print error:', error);
          }
        }, 600);
      }
      return;
    }

    if (extension === 'txt') {
      try {
        const response = await fetch(buildAssetUrl('textPreview', encodedFileName));
        if (!response.ok) throw new Error('Status ' + response.status);
        const text = await response.text();
        const textWindow = window.open('', '_blank');
        if (textWindow) {
          textWindow.document.write('<!doctype html><html><head><title>' + escapeHtml(fileName) + '</title><style>@page { margin: 0; } * { margin: 0; padding: 0; } body { margin: 0; padding: 1cm; font-family: monospace; white-space: pre-wrap; word-break: break-word; } @media print { * { margin: 0 !important; padding: 0 !important; } body { margin: 0 !important; padding: 1cm !important; } }</style></head><body><pre>' + escapeHtml(text) + '</pre></body></html>');
          textWindow.document.close();
          textWindow.focus();
          textWindow.print();
        }
      } catch (error) {
        console.error('Print text error:', error);
      }
    }
  }

  async function startPrintFlow(encodedFileName) {
    await showPreview(encodedFileName);
    await printPreview(encodedFileName);
  }

  async function openLayoutEditor(encodedFileName) {
    if (encodedFileName) {
      await showPreview(encodedFileName);
      return;
    }

    if (!currentPreviewEncodedFileName && currentFileNames[0]) {
      await showPreview(encodeURIComponent(currentFileNames[0]));
    }
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

  async function newSession(options) {
    const skipConfirm = Boolean(options && options.skipConfirm);

    if (!skipConfirm && !confirm(t('newSessionConfirm'))) {
      return;
    }

    try {
      // Always clear the full folder for privacy between customers.
      if (hasSecureFetchAccess()) {
        await fetch(currentAccessCode ? '/secure/delete-all/' + folderName + accessQuery() : '/secure/delete-all/' + folderName, {
          method: 'DELETE',
          headers: secureHeaders()
        });
      }

      await fetch('/delete-all/' + folderName, { method: 'DELETE' });
    } catch (error) {
      console.error('Delete all error:', error);
    }

    localStorage.removeItem(uploaderTokenKey);
    currentAccessCode = '';

    try {
      currentAccessCode = await createSessionAccessCode();
    } catch (error) {
      console.error('Create session access code error:', error);
      currentAccessCode = '';
    }

    const uploadUrl = buildUploadUrl(currentAccessCode);
    if (uploadLink) {
      uploadLink.href = uploadUrl;
    }
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
  async function restartSessionFromTimeout() {
    await baseNewSession({ skipConfirm: true });
  }

  const sessionTimeoutApi = window.createSessionTimeoutController({
    translate: t,
    restartSession: restartSessionFromTimeout,
    minimumMs: 5 * 60 * 1000,
    responseMs: 60 * 1000
  });

  newSession = sessionTimeoutApi.wrapRestart(baseNewSession);
  window.showPreview = showPreview;
  window.startPrintFlow = startPrintFlow;
  window.openLayoutEditor = openLayoutEditor;
  window.printPreview = printPreview;
  window.deleteFile = deleteFile;

  if (previewPrintButton) {
    previewPrintButton.addEventListener('click', function () {
      if (!currentPreviewEncodedFileName) return;
      startPrintFlow(currentPreviewEncodedFileName);
    });
  }

  document.getElementById('new-session-btn').addEventListener('click', newSession);
  if (finishButton) {
    finishButton.addEventListener('click', newSession);
  }

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

  if (downloadAllButton) {
    downloadAllButton.addEventListener('click', downloadAllFiles);
  }

  if (printAllButton) {
    printAllButton.addEventListener('click', printAllFiles);
  }

  applyLanguage();
  window.addEventListener('scroll', hideActiveHoverPreview, true);
  window.addEventListener('resize', hideActiveHoverPreview);
  ensureFallbackButtons();
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