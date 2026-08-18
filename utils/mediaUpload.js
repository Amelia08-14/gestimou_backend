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
const saveImageDataUrl = async (dataUrl, subdir) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const ext = EXT_BY_MIME[parsed.mimeType];
  if (!ext) return null;

  const buffer = Buffer.from(parsed.base64Data, 'base64');
  if (buffer.length > 15 * 1024 * 1024) return null; // 15MB cap

  const uploadsDir = path.join(__dirname, '..', 'uploads', subdir);
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);

  return `/uploads/${subdir}/${filename}`;
};

module.exports = { parseDataUrl, saveImageDataUrl };
