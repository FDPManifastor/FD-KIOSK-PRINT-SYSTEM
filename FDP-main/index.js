const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const archiver = require('archiver');
const PDFKitDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument, StandardFonts } = require('pdf-lib');
const sharp = require('sharp');
const QRCode = require('qrcode');

const app = express();
const port = Number.parseInt(process.env.PORT, 10) || 3000;
const host = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, 'public');

if (process.env.NODE_ENV === 'development') {
  try {
    const livereload = require('livereload');
    const connectLivereload = require('connect-livereload');
    const liveReloadServer = livereload.createServer({ exts: ['html', 'css', 'js'] });

    liveReloadServer.watch(publicDir);
    app.use(connectLivereload());

    liveReloadServer.server.once('connection', () => {
      setTimeout(() => {
        liveReloadServer.refresh('/');
      }, 100);
    });
  } catch (error) {
    console.warn('Live reload niet beschikbaar in development:', error.message);
  }
}

app.use('/healthz', (req, res) => {
  res.status(200).send('ok');
});

const copyFolders = ['copy1', 'copy2', 'copy3', 'copy4'];
const utrechtFolders = ['utrecht_copy1', 'utrecht_copy2', 'utrecht_copy3'];
const hoogvlietFolders = ['hoogvliet_copy1', 'hoogvliet_copy2'];
const testFolders = ['test_copy1'];
const validFolders = [...copyFolders, ...utrechtFolders, ...hoogvlietFolders, ...testFolders];
const maxUploadFilesPerRequest = 50;
const accessLinkTtlMs = 10 * 60 * 1000;
const supportedUploadExtensions = new Set(['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif']);
const genericUploadMimeTypes = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/download',
  'application/force-download',
  'application/x-download',
  'application/unknown'
]);
const extensionMimeTypes = {
  '.pdf': new Set(['application/pdf']),
  '.doc': new Set(['application/msword', 'application/doc', 'application/vnd.ms-word']),
  '.docx': new Set([
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip'
  ]),
  '.txt': new Set(['text/plain']),
  '.jpg': new Set(['image/jpeg', 'image/jpg', 'image/pjpeg']),
  '.jpeg': new Set(['image/jpeg', 'image/jpg', 'image/pjpeg']),
  '.png': new Set(['image/png', 'image/x-png']),
  '.webp': new Set(['image/webp']),
  '.gif': new Set(['image/gif']),
  '.bmp': new Set(['image/bmp', 'image/x-ms-bmp']),
  '.tif': new Set(['image/tiff']),
  '.tiff': new Set(['image/tiff']),
  '.avif': new Set(['image/avif']),
  '.heic': new Set(['image/heic', 'image/heif']),
  '.heif': new Set(['image/heif', 'image/heic'])
};

// In-memory ownership and access registry (ephemeral on restart).
const fileOwners = new Map();
const accessLinks = new Map();
const activeSessionOwners = new Map();

app.use(express.static(publicDir));

app.get('/qr', async (req, res) => {
  const text = typeof req.query.text === 'string' ? req.query.text : '';
  const sizeRaw = Number.parseInt(req.query.size, 10);
  const size = Number.isFinite(sizeRaw) && sizeRaw >= 100 && sizeRaw <= 1200 ? sizeRaw : 220;

  if (!text || text.length > 3000) {
    return res.status(400).send('Invalid qr text');
  }

  try {
    const svg = await QRCode.toString(text, {
      type: 'svg',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(svg);
  } catch (error) {
    return res.status(500).send('QR generation failed');
  }
});

// Ensure all upload folders exist
const uploadDirs = validFolders.map(folder => path.join('uploads', folder));
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function isValidFolder(folder) {
  return validFolders.includes(folder);
}

function getUploaderToken(req) {
  const token = req.get('x-uploader-token');
  if (!token || typeof token !== 'string') return null;
  if (token.length < 16 || token.length > 200) return null;
  return token;
}

function buildFileKey(folder, filename) {
  return `${folder}/${filename}`;
}

function cleanupExpiredAccessLinks() {
  const now = Date.now();
  for (const [code, data] of accessLinks.entries()) {
    if (data.expiresAt <= now) accessLinks.delete(code);
  }
}

function setActiveSessionOwner(folder, uploaderToken) {
  activeSessionOwners.set(folder, uploaderToken);

  // Invalidate old QR codes for this folder immediately.
  for (const [code, data] of accessLinks.entries()) {
    if (data.folder === folder) {
      accessLinks.delete(code);
    }
  }
}

function resolveAccess(req, folder) {
  cleanupExpiredAccessLinks();
  const accessCode = req.query.access;
  if (typeof accessCode !== 'string' || !accessCode) return null;
  const access = accessLinks.get(accessCode);
  if (!access) return null;
  if (access.folder !== folder) return null;
  if (access.expiresAt <= Date.now()) {
    accessLinks.delete(accessCode);
    return null;
  }
  return access;
}

function resolveOwner(req, folder) {
  const directToken = getUploaderToken(req);
  if (directToken) return directToken;
  const access = resolveAccess(req, folder);
  if (access) return access.uploaderToken;
  return null;
}

function requireOwner(req, res, folder) {
  const ownerToken = resolveOwner(req, folder);
  if (!ownerToken) {
    res.status(401).json({ error: 'Unauthorized. Geldige uploader-token of access-token vereist.' });
    return null;
  }

  const activeOwner = activeSessionOwners.get(folder);
  if (activeOwner && activeOwner !== ownerToken) {
    res.status(403).json({ error: 'Sessie verlopen. Scan een nieuwe QR-code om door te gaan.' });
    return null;
  }

  if (!activeOwner) {
    activeSessionOwners.set(folder, ownerToken);
  }

  return ownerToken;
}

// Helper function
function getUploadExtension(filename) {
  return path.extname(filename || '').toLowerCase();
}

function isGenericUploadMimeType(mimeType) {
  return genericUploadMimeTypes.has((mimeType || '').toLowerCase());
}

function isAllowedMimeType(extension, mimeType) {
  const normalizedMimeType = (mimeType || '').toLowerCase();

  if (isGenericUploadMimeType(normalizedMimeType)) return true;
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif'].includes(extension) && normalizedMimeType.startsWith('image/')) return true;

  const allowedMimeTypes = extensionMimeTypes[extension];
  return Boolean(allowedMimeTypes && allowedMimeTypes.has(normalizedMimeType));
}

function validateUploadCandidate(file) {
  const extension = getUploadExtension(file && file.originalname);

  if (!supportedUploadExtensions.has(extension)) {
    return {
      ok: false,
      error: 'Unsupported file type. Ondersteunde bestanden: PDF, DOC, DOCX, TXT, JPG, JPEG, PNG, WEBP, GIF, BMP, TIF, TIFF, AVIF, HEIC, HEIF.'
    };
  }

  if (!isAllowedMimeType(extension, file && file.mimetype)) {
    return {
      ok: false,
      error: 'Unsupported file type. Het bestandstype of MIME-type wordt niet ondersteund.'
    };
  }

  return { ok: true, extension };
}

function sanitizeUploadedFilename(originalName) {
  const baseName = path.basename(String(originalName || 'bestand'));
  const normalized = baseName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '-')
    .trim();

  if (!normalized) return 'bestand';
  if (normalized === '.' || normalized === '..') return 'bestand';
  return normalized;
}

function resolveUniqueFilename(uploadPath, originalName) {
  const sanitizedName = sanitizeUploadedFilename(originalName);
  const parsed = path.parse(sanitizedName);
  const extension = parsed.ext;
  const rawBase = parsed.name || 'bestand';
  const safeBase = rawBase.trim() || 'bestand';

  let candidate = safeBase + extension;
  let counter = 2;

  while (fs.existsSync(path.join(uploadPath, candidate))) {
    candidate = `${safeBase} (${counter})${extension}`;
    counter += 1;
  }

  return candidate;
}

function createUploadMiddleware(uploadPath) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => {
      const filename = resolveUniqueFilename(uploadPath, file.originalname);
      cb(null, filename);
    }
  });

  return multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      const validation = validateUploadCandidate(file);
      if (!validation.ok) {
        const error = new Error(validation.error);
        error.statusCode = 400;
        return cb(error);
      }

      return cb(null, true);
    }
  });
}

function createUploadRoute(folder) {
  return (req, res) => {
    const sessionAccess = resolveAccess(req, folder);
    const uploaderToken = sessionAccess ? sessionAccess.uploaderToken : getUploaderToken(req);
    if (!uploaderToken) {
      return res.status(401).json({ error: 'Uploader token ontbreekt.' });
    }

    const activeOwner = activeSessionOwners.get(folder);
    if (activeOwner && activeOwner !== uploaderToken) {
      return res.status(403).json({ error: 'Sessie verlopen. Scan een nieuwe QR-code om door te gaan.' });
    }
    if (!activeOwner) {
      activeSessionOwners.set(folder, uploaderToken);
    }

    let uploadedFiles = [];
    if (Array.isArray(req.files)) {
      uploadedFiles = req.files;
    } else if (req.files && typeof req.files === 'object') {
      uploadedFiles = Object.values(req.files).flat();
    } else if (req.file) {
      uploadedFiles = [req.file];
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'Geen bestand ontvangen.' });
    }

    uploadedFiles.forEach((uploadedFile) => {
      fileOwners.set(buildFileKey(folder, uploadedFile.filename), uploaderToken);
    });

    return res.status(200).json({
      ok: true,
      filenames: uploadedFiles.map((uploadedFile) => uploadedFile.filename),
      folder
    });
  };
}

function sanitizeAndResolveFilePath(folder, filename) {
  const filePath = path.join('uploads', folder, filename);
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(`uploads/${folder}`);
  if (!resolvedPath.startsWith(resolvedDir)) return null;
  if (!fs.existsSync(filePath)) return null;
  return { filePath, resolvedPath };
}

function userOwnsFile(folder, filename, ownerToken) {
  const owner = fileOwners.get(buildFileKey(folder, filename));
  return owner && owner === ownerToken;
}

async function sendPdfFromFile(res, inputPath, outputName, extension, options = {}) {
  const disposition = options.disposition || 'attachment';
  const pdfFileName = `${outputName}.pdf`;
  const doc = new PDFKitDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${pdfFileName}"`);
  doc.pipe(res);

  if (extension === '.txt') {
    const textContent = fs.readFileSync(inputPath, 'utf8');
    doc.fontSize(12).text(textContent || '(Leeg tekstbestand)');
  } else if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif'].includes(extension)) {
    let imageSource = inputPath;
    if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
      imageSource = await sharp(inputPath).png().toBuffer();
    }

    doc.image(imageSource, {
      fit: [520, 700],
      align: 'center',
      valign: 'center'
    });
  } else {
    doc.fontSize(13).text('Dit bestandstype kan niet inhoudelijk gerenderd worden naar PDF.');
    doc.moveDown(1);
    doc.text(`Bestandsnaam: ${outputName}${extension}`);
  }

  doc.end();
}

function getSafeFolderFiles(folder) {
  const folderPath = path.resolve(path.join('uploads', folder));
  const files = fs.readdirSync(folderPath)
    .filter(f => f !== '.DS_Store')
    .filter((filename) => {
      const absolutePath = path.resolve(path.join(folderPath, filename));
      return absolutePath.startsWith(folderPath) && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
    });

  return { folderPath, files };
}

function imageTargetSize(pageWidth, pageHeight, imageWidth, imageHeight) {
  const margin = 36;
  const maxWidth = pageWidth - (margin * 2);
  const maxHeight = pageHeight - (margin * 2);
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  return {
    width: imageWidth * scale,
    height: imageHeight * scale,
    margin
  };
}

async function addNotePage(doc, font, title, message) {
  const page = doc.addPage([595.28, 841.89]);
  page.drawText(title, {
    x: 40,
    y: 790,
    size: 16,
    font
  });
  page.drawText(message, {
    x: 40,
    y: 760,
    size: 11,
    font,
    maxWidth: 515,
    lineHeight: 14
  });
}

async function appendImageAsPdfPage(doc, filePath, extension) {
  const imageBuffer = fs.readFileSync(filePath);
  let embedBuffer = imageBuffer;
  let embedType = extension;

  if (!['.jpg', '.jpeg', '.png'].includes(extension)) {
    embedBuffer = await sharp(imageBuffer).png().toBuffer();
    embedType = '.png';
  }

  const image = embedType === '.png'
    ? await doc.embedPng(embedBuffer)
    : await doc.embedJpg(embedBuffer);

  const page = doc.addPage([595.28, 841.89]);
  const size = imageTargetSize(page.getWidth(), page.getHeight(), image.width, image.height);
  page.drawImage(image, {
    x: (page.getWidth() - size.width) / 2,
    y: (page.getHeight() - size.height) / 2,
    width: size.width,
    height: size.height
  });
}

async function appendTextAsPdfPages(doc, font, filePath, filename) {
  const rawText = fs.readFileSync(filePath, 'utf8');
  const content = rawText && rawText.trim() ? rawText : '(Leeg tekstbestand)';
  const chunkSize = 3600;

  for (let offset = 0; offset < content.length; offset += chunkSize) {
    const chunk = content.slice(offset, offset + chunkSize);
    const page = doc.addPage([595.28, 841.89]);
    const pageNumber = Math.floor(offset / chunkSize) + 1;

    page.drawText(`${filename} (tekst) - pagina ${pageNumber}`, {
      x: 40,
      y: 790,
      size: 12,
      font
    });

    page.drawText(chunk, {
      x: 40,
      y: 760,
      size: 10,
      font,
      maxWidth: 515,
      lineHeight: 12
    });
  }
}

async function createCombinedPdfBuffer(folder, files) {
  const outputPdf = await PDFLibDocument.create();
  const font = await outputPdf.embedFont(StandardFonts.Helvetica);
  let addedPages = 0;

  for (const filename of files) {
    const extension = path.extname(filename).toLowerCase();
    const { filePath } = sanitizeAndResolveFilePath(folder, filename) || {};
    if (!filePath) continue;

    try {
      if (extension === '.pdf') {
        const sourceBytes = fs.readFileSync(filePath);
        const sourcePdf = await PDFLibDocument.load(sourceBytes, { ignoreEncryption: true });
        const sourcePageIndices = sourcePdf.getPageIndices();
        if (sourcePageIndices.length === 0) {
          await addNotePage(outputPdf, font, 'Lege PDF overgeslagen', `Bestand ${filename} bevat geen pagina's.`);
          addedPages += 1;
          continue;
        }
        const copiedPages = await outputPdf.copyPages(sourcePdf, sourcePageIndices);
        copiedPages.forEach((page) => outputPdf.addPage(page));
        addedPages += copiedPages.length;
        continue;
      }

      if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif'].includes(extension)) {
        await appendImageAsPdfPage(outputPdf, filePath, extension);
        addedPages += 1;
        continue;
      }

      if (extension === '.txt') {
        await appendTextAsPdfPages(outputPdf, font, filePath, filename);
        addedPages += 1;
        continue;
      }

      await addNotePage(outputPdf, font, 'Bestand toegevoegd als infopagina', `Bestand ${filename} kon niet inhoudelijk worden gerenderd naar PDF. Dit info-blad is toegevoegd zodat alle uploads in de printset zitten.`);
      addedPages += 1;
    } catch (error) {
      await addNotePage(outputPdf, font, 'Bestand kon niet verwerkt worden', `Bestand ${filename} kon niet worden toegevoegd. Reden: ${error.message}`);
      addedPages += 1;
    }
  }

  if (addedPages === 0) {
    await addNotePage(outputPdf, font, 'Geen bestanden verwerkt', 'Er waren geen bruikbare bestanden om samen te voegen.');
  }

  return Buffer.from(await outputPdf.save());
}

function streamZipDownload(res, folder, files) {
  const zipFilename = `${folder}-files.zip`;
  const folderPath = path.resolve(path.join('uploads', folder));

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.end();
  });

  archive.pipe(res);

  for (const filename of files) {
    const absolutePath = path.resolve(path.join(folderPath, filename));
    if (absolutePath.startsWith(folderPath) && fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      archive.file(absolutePath, { name: filename });
    }
  }

  archive.finalize();
}

// Weigert uploads zolang een station met timer niet is geactiveerd
// (draait vóór multer, dus er wordt niets opgeslagen).
function requireActivatedStation(folder) {
  return (req, res, next) => {
    if (!timerFolders.includes(folder)) return next();
    const session = stationSessions.get(folder);
    if (session && !session.stoppedAt) return next(); // actief of gepauzeerd
    return res.status(423).json({ error: 'Deze computer is nog niet geactiveerd. Vraag een van onze medewerkers om hem te activeren.' });
  };
}

// Upload routes
app.post('/upload_copy1', requireActivatedStation('copy1'), createUploadMiddleware('uploads/copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy1'));
app.post('/upload_copy2', requireActivatedStation('copy2'), createUploadMiddleware('uploads/copy2').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy2'));
app.post('/upload_copy3', requireActivatedStation('copy3'), createUploadMiddleware('uploads/copy3').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy3'));
app.post('/upload_copy4', requireActivatedStation('copy4'), createUploadMiddleware('uploads/copy4').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy4'));
app.post('/upload_utrecht_copy1', requireActivatedStation('utrecht_copy1'), createUploadMiddleware('uploads/utrecht_copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('utrecht_copy1'));
app.post('/upload_utrecht_copy2', requireActivatedStation('utrecht_copy2'), createUploadMiddleware('uploads/utrecht_copy2').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('utrecht_copy2'));
app.post('/upload_utrecht_copy3', requireActivatedStation('utrecht_copy3'), createUploadMiddleware('uploads/utrecht_copy3').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('utrecht_copy3'));
app.post('/upload_hoogvliet_copy1', requireActivatedStation('hoogvliet_copy1'), createUploadMiddleware('uploads/hoogvliet_copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('hoogvliet_copy1'));
app.post('/upload_hoogvliet_copy2', requireActivatedStation('hoogvliet_copy2'), createUploadMiddleware('uploads/hoogvliet_copy2').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('hoogvliet_copy2'));
app.post('/upload_test_copy1', requireActivatedStation('test_copy1'), createUploadMiddleware('uploads/test_copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('test_copy1'));

// Compatibility route so QR links also work when .html is omitted.
app.get('/upload_test_copy1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload_test_copy1.html'));
});

app.post('/secure/access-link/:folder', (req, res) => {
  const folder = req.params.folder;
  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const uploaderToken = getUploaderToken(req);
  if (!uploaderToken) {
    return res.status(401).json({ error: 'Uploader token ontbreekt.' });
  }

  // New QR means new session owner for this folder.
  setActiveSessionOwner(folder, uploaderToken);

  const accessCode = crypto.randomBytes(18).toString('hex');
  accessLinks.set(accessCode, {
    uploaderToken,
    folder,
    expiresAt: Date.now() + accessLinkTtlMs
  });

  const pageName = `files_${folder}.html`;
  return res.json({
    ok: true,
    accessCode,
    expiresInSeconds: Math.floor(accessLinkTtlMs / 1000),
    accessPath: `/${pageName}?access=${encodeURIComponent(accessCode)}`
  });
});

app.post('/secure/start-session/:folder', (req, res) => {
  const folder = req.params.folder;
  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const uploaderToken = getUploaderToken(req);
  if (!uploaderToken) {
    return res.status(401).json({ error: 'Uploader token ontbreekt.' });
  }

  setActiveSessionOwner(folder, uploaderToken);
  return res.json({ ok: true, folder });
});

// Protected file listing
app.get('/secure/files/:folder', (req, res) => {
  const folder = req.params.folder;
  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const folderPath = `uploads/${folder}`;
  try {
    const files = fs.readdirSync(folderPath)
      .filter(f => f !== '.DS_Store')
      .filter(f => userOwnsFile(folder, f, ownerToken));

    res.json({ folder, files, count: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected file download
app.get('/secure/download/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;

  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');
  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');
  if (!userOwnsFile(folder, filename, ownerToken)) {
    return res.status(403).send('Geen toegang tot dit bestand');
  }

  res.download(file.filePath, filename);
});

app.get('/secure/download-all/:folder', (req, res) => {
  const { folder } = req.params;

  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const folderPath = path.join('uploads', folder);
  try {
    const files = fs.readdirSync(folderPath)
      .filter(f => f !== '.DS_Store')
      .filter(f => userOwnsFile(folder, f, ownerToken));

    if (files.length === 0) {
      return res.status(404).json({ error: 'Geen bestanden gevonden om te downloaden.' });
    }

    return streamZipDownload(res, folder, files);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/secure/download-all-pdf/:folder', async (req, res) => {
  const { folder } = req.params;

  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  try {
    const { files } = getSafeFolderFiles(folder);
    const ownedFiles = files.filter((filename) => userOwnsFile(folder, filename, ownerToken));

    if (ownedFiles.length === 0) {
      return res.status(404).json({ error: 'Geen bestanden gevonden om te downloaden.' });
    }

    const pdfBuffer = await createCombinedPdfBuffer(folder, ownedFiles);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${folder}-files.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/secure/preview/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');
  if (!userOwnsFile(folder, filename, ownerToken)) return res.status(403).send('Geen toegang tot dit bestand');

  res.sendFile(file.resolvedPath);
});

app.get('/secure/text-preview/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');
  if (!userOwnsFile(folder, filename, ownerToken)) return res.status(403).send('Geen toegang tot dit bestand');

  const extension = path.extname(filename).toLowerCase();
  if (extension !== '.txt') return res.status(400).send('Alleen tekstpreview is ondersteund');

  const content = fs.readFileSync(file.filePath, 'utf8').slice(0, 5000);
  res.type('text/plain').send(content || '(Leeg bestand)');
});

app.get('/secure/render-pdf/:folder/:filename', async (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');
  if (!userOwnsFile(folder, filename, ownerToken)) return res.status(403).send('Geen toegang tot dit bestand');

  const extension = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, extension);

  const inlineRequested = req.query.inline === '1';

  if (extension === '.pdf') {
    if (inlineRequested) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${baseName}.pdf"`);
      return res.sendFile(file.resolvedPath);
    }
    return res.download(file.filePath, `${baseName}.pdf`);
  }

  try {
    await sendPdfFromFile(res, file.filePath, baseName, extension, {
      disposition: inlineRequested ? 'inline' : 'attachment'
    });
  } catch (error) {
    res.status(500).send('Kon PDF niet renderen: ' + error.message);
  }
});

app.delete('/secure/delete/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).json({ error: 'Invalid folder' });

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!userOwnsFile(folder, filename, ownerToken)) return res.status(403).json({ error: 'Geen toegang tot dit bestand' });

  try {
    fs.unlinkSync(file.filePath);
    fileOwners.delete(buildFileKey(folder, filename));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/secure/delete-all/:folder', (req, res) => {
  const { folder } = req.params;
  if (!isValidFolder(folder)) return res.status(400).json({ error: 'Invalid folder' });

  const ownerToken = requireOwner(req, res, folder);
  if (!ownerToken) return;

  const folderPath = path.join('uploads', folder);

  try {
    const files = fs.readdirSync(folderPath)
      .filter(filename => filename !== '.DS_Store')
      .filter(filename => userOwnsFile(folder, filename, ownerToken));

    for (const filename of files) {
      const filePath = path.join(folderPath, filename);
      const resolvedDir = path.resolve(folderPath);
      const resolvedFile = path.resolve(filePath);
      if (resolvedFile.startsWith(resolvedDir)) {
        fs.unlinkSync(filePath);
        fileOwners.delete(buildFileKey(folder, filename));
      }
    }

    return res.json({ ok: true, deleted: files.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/preview/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');

  res.sendFile(file.resolvedPath);
});

// Kleine miniatuur voor de fotoalbum-weergave (ongeveer 320 px, juist gedraaid).
app.get('/thumb/:folder/:filename', async (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');

  const extension = getUploadExtension(filename);
  if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.heic', '.heif'].includes(extension)) {
    return res.status(415).send('No thumbnail for this file type');
  }

  try {
    const thumbnail = await sharp(file.resolvedPath)
      .rotate()
      .resize(320, 320, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(thumbnail);
  } catch (error) {
    return res.status(500).send('Thumbnail failed');
  }
});

app.get('/text-preview/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');

  const extension = path.extname(filename).toLowerCase();
  if (extension !== '.txt') return res.status(400).send('Alleen tekstpreview is ondersteund');

  const content = fs.readFileSync(file.filePath, 'utf8').slice(0, 5000);
  res.type('text/plain').send(content || '(Leeg bestand)');
});

app.get('/render-pdf/:folder/:filename', async (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');

  const extension = path.extname(filename).toLowerCase();
  const baseName = path.basename(filename, extension);

  const inlineRequested = req.query.inline === '1';

  if (extension === '.pdf') {
    if (inlineRequested) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${baseName}.pdf"`);
      return res.sendFile(file.resolvedPath);
    }
    return res.download(file.filePath, `${baseName}.pdf`);
  }

  try {
    await sendPdfFromFile(res, file.filePath, baseName, extension, {
      disposition: inlineRequested ? 'inline' : 'attachment'
    });
  } catch (error) {
    res.status(500).send('Kon PDF niet renderen: ' + error.message);
  }
});

// Legacy public endpoint retained for backward compatibility.
app.get('/files/:folder', (req, res) => {
  const folder = req.params.folder;
  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const folderPath = `uploads/${folder}`;
  try {
    const files = fs.readdirSync(folderPath).filter(f => f !== '.DS_Store');
    res.json({ folder, files, count: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy public download endpoint retained for backward compatibility.
app.get('/download/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).send('Invalid folder');

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).send('File not found');

  res.download(file.filePath, filename);
});

app.get('/download-all/:folder', (req, res) => {
  const { folder } = req.params;

  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  const folderPath = path.join('uploads', folder);
  try {
    const files = fs.readdirSync(folderPath)
      .filter(f => f !== '.DS_Store');

    if (files.length === 0) {
      return res.status(404).json({ error: 'Geen bestanden gevonden om te downloaden.' });
    }

    return streamZipDownload(res, folder, files);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/download-all-pdf/:folder', async (req, res) => {
  const { folder } = req.params;

  if (!isValidFolder(folder)) {
    return res.status(400).json({ error: 'Invalid folder' });
  }

  try {
    const { files } = getSafeFolderFiles(folder);

    if (files.length === 0) {
      return res.status(404).json({ error: 'Geen bestanden gevonden om te downloaden.' });
    }

    const pdfBuffer = await createCombinedPdfBuffer(folder, files);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${folder}-files.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Public delete endpoint
app.delete('/delete/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;
  if (!isValidFolder(folder)) return res.status(400).json({ error: 'Invalid folder' });

  const file = sanitizeAndResolveFilePath(folder, filename);
  if (!file) return res.status(404).json({ error: 'File not found' });

  try {
    fs.unlinkSync(file.filePath);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete all files in a folder (called on new session)
app.delete('/delete-all/:folder', (req, res) => {
  const { folder } = req.params;
  if (!isValidFolder(folder)) return res.status(400).json({ error: 'Invalid folder' });

  const folderPath = `uploads/${folder}`;
  try {
    const files = fs.readdirSync(folderPath).filter(f => f !== '.DS_Store');
    for (const filename of files) {
      const filePath = path.join(folderPath, filename);
      const resolvedDir = path.resolve(folderPath);
      const resolvedFile = path.resolve(filePath);
      if (resolvedFile.startsWith(resolvedDir)) {
        fs.unlinkSync(filePath);
        fileOwners.delete(buildFileKey(folder, filename));
      }
    }
    return res.json({ ok: true, deleted: files.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Station timer (computer vrijgeven vanuit de backoffice)
//
// De backoffice start per station een sessie; het kioskscherm toont dan de
// verstreken tijd en de kosten rechtsonder. Tarief: EUR 0,95 voor de eerste
// 10 minuten, daarna EUR 0,05 per begonnen minuut. Per station kan een
// ander tarief gelden (stationPricingOverrides), bijv. om op de test te proberen.
// Welke stations meedoen staat in STATION_TIMER_FOLDERS (komma-gescheiden),
// standaard alle stations.
// ---------------------------------------------------------------------------
// Tarief: EUR 0,95 voor de eerste 10 minuten, daarna EUR 0,05 per begonnen minuut.
const stationPricing = {
  baseCents: 95,
  baseMinutes: 10,
  stepCents: 5,
  stepMinutes: 1
};
// Afwijkend tarief per station (bijv. om eerst op de teststation te proberen).
const stationPricingOverrides = {};
function pricingFor(folder) {
  return stationPricingOverrides[folder] || stationPricing;
}
// Stations waar de klant zelf op "Ik ben klaar" kan drukken (stopt de tijd).
const selfFinishFolders = validFolders.slice();
// Stations waar het personeel een vrije sessie kan starten (geen tijdslimiet, geen kosten).
const freeSessionFolders = validFolders.slice();
const timerFolders = (process.env.STATION_TIMER_FOLDERS || validFolders.join(','))
  .split(',')
  .map((folder) => folder.trim())
  .filter((folder) => isValidFolder(folder));
const stationStateFile = path.join('uploads', '.station-sessions.json');
const stationSessions = new Map();

function stationLabel(folder) {
  if (folder.startsWith('test_')) return 'TEST ' + folder.replace('test_', '').replace('copy', 'COPY ');
  if (folder.startsWith('utrecht_')) return 'UTRECHT ' + folder.replace('utrecht_', '').replace('copy', 'COPY ');
  if (folder.startsWith('hoogvliet_')) return 'HOOGVLIET ' + folder.replace('hoogvliet_', '').replace('copy', 'COPY ');
  return 'AMSTERDAM ' + folder.replace('copy', 'COPY ');
}

function calculateStationCostCents(elapsedMs, pricing) {
  const p = pricing || stationPricing;
  const baseMs = p.baseMinutes * 60 * 1000;
  const stepMs = p.stepMinutes * 60 * 1000;
  const extraSteps = elapsedMs > baseMs ? Math.ceil((elapsedMs - baseMs) / stepMs) : 0;
  return p.baseCents + extraSteps * p.stepCents;
}

function loadStationSessions() {
  try {
    if (!fs.existsSync(stationStateFile)) return;
    const saved = JSON.parse(fs.readFileSync(stationStateFile, 'utf8'));
    Object.entries(saved || {}).forEach(([folder, session]) => {
      if (timerFolders.includes(folder) && session && Number.isFinite(session.startedAt)) {
        stationSessions.set(folder, session);
      }
    });
  } catch (error) {
    console.warn('Station-sessies konden niet geladen worden:', error.message);
  }
}

function saveStationSessions() {
  try {
    fs.writeFileSync(stationStateFile, JSON.stringify(Object.fromEntries(stationSessions), null, 2));
  } catch (error) {
    console.warn('Station-sessies konden niet opgeslagen worden:', error.message);
  }
}

function describeStation(folder) {
  const session = stationSessions.get(folder) || null;
  const now = Date.now();
  const base = { folder, label: stationLabel(folder), serverNow: now, pricing: pricingFor(folder), selfFinish: selfFinishFolders.includes(folder), freeSessionAllowed: freeSessionFolders.includes(folder) };

  if (!session) return { ...base, status: 'idle' };

  const elapsedMs = sessionElapsedMs(session, now);
  let status = 'active';
  if (session.stoppedAt) status = 'stopped';
  else if (session.pausedAt) status = 'paused';

  return {
    ...base,
    status,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt || null,
    pausedAt: session.pausedAt || null,
    elapsedMs,
    free: !!session.free,
    costCents: session.free ? 0 : calculateStationCostCents(elapsedMs, pricingFor(folder)),
    stoppedBy: session.stoppedBy || null
  };
}

// Betaalde tijd = tijd sinds start, min alle pauzes (ook een lopende pauze).
function sessionElapsedMs(session, now) {
  const endedAt = session.stoppedAt || now;
  const pausedTotal = session.pausedTotalMs || 0;
  const runningPause = session.pausedAt ? Math.max(0, endedAt - session.pausedAt) : 0;
  return Math.max(0, endedAt - session.startedAt - pausedTotal - runningPause);
}

// ---------------------------------------------------------------------------
// Toegang per locatie
//
// Elke locatie heeft een eigen geheime link (/locatie/<sleutel>) waarop alleen de
// eigen stations staan. De eigenaar heeft een beheerlink (/beheer/<sleutel>) met
// het overzicht van alle stations en de links van de locaties.
// Sleutels komen uit de omgeving (OWNER_ACCESS_KEY, ACCESS_KEY_AMSTERDAM,
// ACCESS_KEY_UTRECHT, ACCESS_KEY_HOOGVLIET). Ontbreekt er een, dan wordt die
// eenmalig gemaakt en bewaard in uploads/.access-keys.json.
// BACKOFFICE_PASSWORD (als die is ingesteld) geeft ook volledige toegang.
// ---------------------------------------------------------------------------
const stationLocations = {
  amsterdam: { label: 'Amsterdam', folders: copyFolders },
  utrecht: { label: 'Utrecht', folders: utrechtFolders },
  hoogvliet: { label: 'Hoogvliet', folders: hoogvlietFolders }
};
const accessKeyEnvNames = {
  owner: 'OWNER_ACCESS_KEY',
  amsterdam: 'ACCESS_KEY_AMSTERDAM',
  utrecht: 'ACCESS_KEY_UTRECHT',
  hoogvliet: 'ACCESS_KEY_HOOGVLIET'
};
const accessKeyFile = path.join('uploads', '.access-keys.json');
const accessKeys = loadAccessKeys();

function loadAccessKeys() {
  let saved = {};
  try {
    if (fs.existsSync(accessKeyFile)) saved = JSON.parse(fs.readFileSync(accessKeyFile, 'utf8')) || {};
  } catch (error) {
    console.warn('Toegangssleutels konden niet gelezen worden:', error.message);
  }

  const keys = {};
  let changedFile = false;
  Object.keys(accessKeyEnvNames).forEach((role) => {
    const fromEnv = (process.env[accessKeyEnvNames[role]] || '').trim();
    if (fromEnv) {
      keys[role] = fromEnv;
    } else if (typeof saved[role] === 'string' && saved[role].length >= 16) {
      keys[role] = saved[role];
    } else {
      keys[role] = crypto.randomBytes(18).toString('base64url');
      saved[role] = keys[role];
      changedFile = true;
    }
  });

  if (changedFile) {
    try {
      fs.mkdirSync(path.dirname(accessKeyFile), { recursive: true });
      fs.writeFileSync(accessKeyFile, JSON.stringify(saved, null, 2), { mode: 0o600 });
    } catch (error) {
      console.warn('Toegangssleutels konden niet opgeslagen worden:', error.message);
    }
  }

  console.log('Beheerlink:  /beheer/' + keys.owner);
  Object.keys(stationLocations).forEach((loc) => {
    console.log('Locatielink ' + stationLocations[loc].label + ': /locatie/' + keys[loc]);
  });
  return keys;
}

function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Sleutel -> { role: 'owner' } of { role: 'location', location: 'amsterdam' } of null.
function accessForKey(key) {
  if (!key) return null;
  const password = process.env.BACKOFFICE_PASSWORD || '';
  if (password && sameSecret(key, password)) return { role: 'owner' };
  if (sameSecret(key, accessKeys.owner)) return { role: 'owner' };
  for (const loc of Object.keys(stationLocations)) {
    if (sameSecret(key, accessKeys[loc])) return { role: 'location', location: loc };
  }
  return null;
}

function foldersFor(access) {
  if (!access) return [];
  if (access.role === 'owner') return timerFolders;
  const loc = stationLocations[access.location];
  return loc ? timerFolders.filter((folder) => loc.folders.includes(folder)) : [];
}

// Geen wachtwoord nodig (op verzoek): zonder (geldige) sleutel is er volledige toegang,
// zoals voorheen. Met een locatiesleutel zie en bedien je alleen die locatie.
function requireBackoffice(req, res) {
  const key = String(req.get('x-access-key') || req.get('x-backoffice-key') || '');
  const access = accessForKey(key) || { role: 'owner' };
  const folder = req.params && req.params.folder;
  if (folder && access.role !== 'owner' && !foldersFor(access).includes(folder)) {
    res.status(403).json({ error: 'Dit station hoort niet bij jouw locatie.' });
    return false;
  }
  req.fdpAccess = access;
  return true;
}

function clearFolderFiles(folder) {
  const folderPath = path.resolve(path.join('uploads', folder));
  try {
    fs.readdirSync(folderPath).forEach((filename) => {
      const filePath = path.resolve(path.join(folderPath, filename));
      if (filePath.startsWith(folderPath + path.sep) && fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        fileOwners.delete(buildFileKey(folder, filename));
      }
    });
  } catch (error) {
    console.warn(`Bestanden van ${folder} konden niet gewist worden:`, error.message);
  }
}

function requireTimerFolder(req, res) {
  const folder = req.params.folder;
  if (!timerFolders.includes(folder)) {
    res.status(404).json({ error: 'Timer is niet actief voor dit station.' });
    return null;
  }
  return folder;
}

loadStationSessions();

// Public status, polled by the kiosk screen of that station.
app.get('/station/status/:folder', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const folder = req.params.folder;
  if (!timerFolders.includes(folder)) {
    return res.json({ folder, status: 'disabled', serverNow: Date.now() });
  }
  return res.json(describeStation(folder));
});

app.get('/backoffice', (req, res) => {
  res.sendFile(path.join(publicDir, 'backoffice.html'));
});

app.get('/backoffice/api/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ passwordRequired: false });
});

app.get('/backoffice/api/stations', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireBackoffice(req, res)) return;
  const access = req.fdpAccess;
  return res.json({
    role: access.role,
    location: access.location || null,
    stations: foldersFor(access).map(describeStation),
    serverNow: Date.now()
  });
});

// Overzichtspagina's: beheer (alle stations) en per locatie (alleen eigen stations).
const overviewTemplatePath = path.join(__dirname, 'views', 'overview.html');

function sendOverview(res, config) {
  let html;
  try {
    html = fs.readFileSync(overviewTemplatePath, 'utf8');
  } catch (error) {
    return res.status(500).send('Overzicht niet gevonden.');
  }
  const inject = '<meta name="robots" content="noindex, nofollow">'
    + '<meta name="referrer" content="no-referrer">'
    + '<script>window.FDPAccess = ' + JSON.stringify(config).replace(/</g, '\\u003c') + ';</script>';
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html.replace('</head>', inject + '</head>'));
}

function sendInvalidLink(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).send('<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Link niet geldig</title></head><body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f4f4f5">'
    + '<div style="text-align:center;padding:2rem"><h1 style="color:#b91c1c">Link niet geldig</h1>'
    + '<p>Deze link werkt niet (meer). Vraag de juiste link voor jouw locatie.</p></div></body></html>');
}

// Startpagina: weer het volledige overzicht van alle stations, zonder inloggen.
function sendStartPage(req, res) { return sendOverview(res, { key: '', role: 'open' }); }
app.get('/', sendStartPage);
app.get('/index.html', sendStartPage);

app.get('/beheer/:key', (req, res) => {
  const access = accessForKey(req.params.key);
  if (!access || access.role !== 'owner') return sendInvalidLink(res);
  return sendOverview(res, {
    key: req.params.key,
    role: 'owner',
    locations: Object.keys(stationLocations).map((loc) => ({
      id: loc,
      label: stationLocations[loc].label,
      path: '/locatie/' + accessKeys[loc]
    }))
  });
});

app.get('/locatie/:key', (req, res) => {
  const access = accessForKey(req.params.key);
  if (!access || access.role !== 'location') return sendInvalidLink(res);
  return sendOverview(res, {
    key: req.params.key,
    role: 'location',
    location: access.location,
    label: stationLocations[access.location].label
  });
});

app.post('/backoffice/api/stations/:folder/start', (req, res) => {
  if (!requireBackoffice(req, res)) return;
  const folder = requireTimerFolder(req, res);
  if (!folder) return;

  const current = stationSessions.get(folder);
  if (current && !current.stoppedAt) {
    return res.status(409).json({ error: 'Deze computer is al vrijgegeven.', station: describeStation(folder) });
  }

  // ?mode=free: vrije sessie zonder tijdslimiet en zonder kosten (alleen waar toegestaan).
  const free = req.query && req.query.mode === 'free';
  if (free && !freeSessionFolders.includes(folder)) {
    return res.status(403).json({ error: 'Vrije sessie is voor dit station nog niet beschikbaar.', station: describeStation(folder) });
  }

  // Privacy: begin elke klant met een lege map, zonder bestanden van de vorige klant.
  clearFolderFiles(folder);
  stationSessions.set(folder, { startedAt: Date.now(), stoppedAt: null, pausedAt: null, pausedTotalMs: 0, free: !!free });
  saveStationSessions();
  console.log(`Station ${folder} vrijgegeven${free ? ' (vrije sessie)' : ''}.`);
  return res.json({ ok: true, station: describeStation(folder) });
});

app.post('/backoffice/api/stations/:folder/stop', (req, res) => {
  if (!requireBackoffice(req, res)) return;
  const folder = requireTimerFolder(req, res);
  if (!folder) return;

  const current = stationSessions.get(folder);
  if (!current || current.stoppedAt) {
    return res.status(409).json({ error: 'Deze computer heeft geen lopende sessie.', station: describeStation(folder) });
  }

  return res.json({ ok: true, station: stopStationSession(folder, current, 'staff') });
});

function stopStationSession(folder, current, by) {
  const stopTime = Date.now();
  if (current.pausedAt) {
    current.pausedTotalMs = (current.pausedTotalMs || 0) + (stopTime - current.pausedAt);
    current.pausedAt = null;
  }
  current.stoppedAt = stopTime;
  current.stoppedBy = by;
  saveStationSessions();
  const station = describeStation(folder);
  console.log(`Station ${folder} gestopt (${by}) na ${Math.round(station.elapsedMs / 1000)}s, kosten ${station.costCents} cent.`);
  return station;
}

// De klant drukt op het kioskscherm op "Ik ben klaar": tijd stopt, kiosk gaat op slot.
app.post('/station/finish/:folder', (req, res) => {
  const folder = req.params.folder;
  if (!timerFolders.includes(folder) || !selfFinishFolders.includes(folder)) {
    return res.status(404).json({ error: 'Niet beschikbaar voor dit station.' });
  }
  const current = stationSessions.get(folder);
  if (!current || current.stoppedAt) {
    return res.status(409).json({ error: 'Er is geen lopende sessie.', station: describeStation(folder) });
  }
  return res.json({ ok: true, station: stopStationSession(folder, current, 'customer') });
});

// Pause: time and cost stand still until resumed.
app.post('/backoffice/api/stations/:folder/pause', (req, res) => {
  if (!requireBackoffice(req, res)) return;
  const folder = requireTimerFolder(req, res);
  if (!folder) return;

  const current = stationSessions.get(folder);
  if (!current || current.stoppedAt || current.pausedAt) {
    return res.status(409).json({ error: 'Er is geen lopende sessie om te pauzeren.', station: describeStation(folder) });
  }

  current.pausedAt = Date.now();
  saveStationSessions();
  return res.json({ ok: true, station: describeStation(folder) });
});

app.post('/backoffice/api/stations/:folder/resume', (req, res) => {
  if (!requireBackoffice(req, res)) return;
  const folder = requireTimerFolder(req, res);
  if (!folder) return;

  const current = stationSessions.get(folder);
  if (!current || current.stoppedAt || !current.pausedAt) {
    return res.status(409).json({ error: 'Deze sessie staat niet op pauze.', station: describeStation(folder) });
  }

  current.pausedTotalMs = (current.pausedTotalMs || 0) + (Date.now() - current.pausedAt);
  current.pausedAt = null;
  saveStationSessions();
  return res.json({ ok: true, station: describeStation(folder) });
});

// Clears a finished session so the kiosk no longer shows the final amount.
app.post('/backoffice/api/stations/:folder/reset', (req, res) => {
  if (!requireBackoffice(req, res)) return;
  const folder = requireTimerFolder(req, res);
  if (!folder) return;

  const current = stationSessions.get(folder);
  if (current && !current.stoppedAt) {
    return res.status(409).json({ error: 'Stop eerst de lopende sessie.', station: describeStation(folder) });
  }

  stationSessions.delete(folder);
  saveStationSessions();
  return res.json({ ok: true, station: describeStation(folder) });
});

// Browser page
app.get('/browser', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><title>File Browser</title><style>body{font-family:Arial;margin:20px;background:#f5f5f5}.container{max-width:1000px;margin:0 auto;background:#fff;padding:20px;border-radius:8px}h1{color:#333}.folder-section{margin:20px 0;padding:15px;border:1px solid #ddd;border-radius:5px;background:#fafafa}.folder-title{font-weight:bold;font-size:18px;color:#dc2626;margin-bottom:10px}.file-list{list-style:none;padding:0}.file-item{padding:8px;margin:5px 0;background:#fff;border-left:3px solid #dc2626;display:flex;justify-content:space-between;align-items:center}.download-btn{background:#dc2626;color:#fff;padding:5px 15px;border:none;border-radius:4px;cursor:pointer;text-decoration:none}.download-btn:hover{background:#b91c1c}.empty{color:#999;font-style:italic}</style></head><body><div class="container"><h1>📁 FD Printing - Files</h1><div id="content"></div></div><script>async function load(){const folders=${JSON.stringify(validFolders)};const el=document.getElementById('content');for(const f of folders){try{const r=await fetch('/files/'+f);const d=await r.json();const label=(f.startsWith('utrecht_')||f.startsWith('hoogvliet_'))?f.replaceAll('_',' ').toUpperCase():'COPY '+f.replace('copy','');let h='<div class="folder-section"><div class="folder-title">'+label+'</div>';if(d.files.length===0){h+='<p class="empty">No files</p>'}else{h+='<ul class="file-list">';d.files.forEach(file=>{h+='<li class="file-item"><span>'+file+'</span><a href="/download/'+f+'/'+file+'" class="download-btn">Download</a></li>'});h+='</ul>'}h+='</div>';el.innerHTML+=h}catch(e){el.innerHTML+='<p>Error: '+e.message+'</p>'}}}load()</script></body></html>`);
});

app.use((err, req, res, next) => {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Bestand is te groot om te uploaden.' });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: `Te veel bestanden tegelijk of ongeldig upload-veld. Probeer maximaal ${maxUploadFilesPerRequest} bestanden per keer.` });
    }

    return res.status(400).json({ error: 'Upload failed. ' + err.message });
  }

  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    console.error('Request error:', err);
    return res.status(500).json({ error: 'Upload failed. Probeer het opnieuw.' });
  }

  return res.status(statusCode).json({ error: err.message || 'Upload failed.' });
});

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
  console.log(`Browser: http://${host}:${port}/browser`);
});
