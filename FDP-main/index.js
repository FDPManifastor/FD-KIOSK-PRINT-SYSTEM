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

// Upload routes
app.post('/upload_copy1', createUploadMiddleware('uploads/copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy1'));
app.post('/upload_copy2', createUploadMiddleware('uploads/copy2').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy2'));
app.post('/upload_copy3', createUploadMiddleware('uploads/copy3').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy3'));
app.post('/upload_copy4', createUploadMiddleware('uploads/copy4').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('copy4'));
app.post('/upload_utrecht_copy1', createUploadMiddleware('uploads/utrecht_copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('utrecht_copy1'));
app.post('/upload_utrecht_copy2', createUploadMiddleware('uploads/utrecht_copy2').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('utrecht_copy2'));
app.post('/upload_utrecht_copy3', createUploadMiddleware('uploads/utrecht_copy3').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('utrecht_copy3'));
app.post('/upload_hoogvliet_copy1', createUploadMiddleware('uploads/hoogvliet_copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('hoogvliet_copy1'));
app.post('/upload_hoogvliet_copy2', createUploadMiddleware('uploads/hoogvliet_copy2').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('hoogvliet_copy2'));
app.post('/upload_test_copy1', createUploadMiddleware('uploads/test_copy1').fields([{ name: 'mijnBestand', maxCount: maxUploadFilesPerRequest }, { name: 'mijnBestand[]', maxCount: maxUploadFilesPerRequest }]), createUploadRoute('test_copy1'));

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
