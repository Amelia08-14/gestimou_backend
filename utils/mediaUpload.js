const fs = require('fs');
const path = require('path');

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const parseDataUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
};

// Saves a base64 `data:image/...;base64,...` payload under uploads/<subdir>/
// and returns the public URL, or null if the input isn't a valid/allowed image.
const saveImageDataUrl = async (dataUrl, subdir, { maxBytes = 15 * 1024 * 1024 } = {}) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const ext = EXT_BY_MIME[parsed.mimeType];
  if (!ext) return null;

  const buffer = Buffer.from(parsed.base64Data, 'base64');
  if (buffer.length > maxBytes) return null;

  const uploadsDir = path.join(__dirname, '..', 'uploads', subdir);
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/${subdir}/${filename}`;
};

// Best-effort removal of a file previously returned by saveImageDataUrl.
// Only touches files directly under uploads/<subdir>/.
const removeUploadedImage = async (publicUrl, subdir) => {
  const clean = String(publicUrl || '').replace(/\\/g, '/');
  const prefix = `/uploads/${subdir}/`;
  if (!clean.startsWith(prefix)) return;
  const filename = path.basename(clean);
  if (!filename || filename.includes('..')) return;
  await fs.promises.unlink(path.join(__dirname, '..', 'uploads', subdir, filename)).catch(() => null);
};

module.exports = { parseDataUrl, saveImageDataUrl, removeUploadedImage };
