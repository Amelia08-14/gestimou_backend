const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Document, Residence } = require('../models');

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const parseDataUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
};

const extFromMimeType = (mimeType) => {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (mimeType === 'application/vnd.ms-excel') return 'xls';
  if (mimeType === 'application/msword') return 'doc';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return null;
};

const extFromFilename = (filename = '') => {
  const ext = path.extname(String(filename)).replace('.', '').toLowerCase();
  return ext || null;
};

const formatSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
};

const safeJoinUploads = (urlPath) => {
  const clean = String(urlPath || '').replace(/\\/g, '/');
  if (!clean.startsWith('/uploads/documents/')) return null;
  const filename = clean.split('/').pop();
  if (!filename || filename.includes('..')) return null;
  return path.join(__dirname, '..', 'uploads', 'documents', filename);
};

// @desc    List documents (optionally filter by category, residenceId, search)
// @route   GET /api/documents
exports.getDocuments = async (req, res) => {
  try {
    const { category, residenceId, q } = req.query;
    const where = {};

    if (category) where.category = category;
    if (residenceId) where.residenceId = residenceId;
    if (q) {
      where.name = { [Op.like]: `%${q}%` };
    }

    const documents = await Document.findAll({
      where,
      include: [{ model: Residence, attributes: ['id', 'name', 'zone'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Upload document (base64) and create DB record
// @route   POST /api/documents
exports.createDocument = async (req, res) => {
  try {
    const { name, category, residenceId, dataUrl } = req.body || {};
    if (!category) return res.status(400).json({ error: 'Missing fields' });

    let filename = null;
    let byteLength = 0;
    let ext = null;

    if (req.file) {
      filename = path.basename(req.file.filename);
      byteLength = Number(req.file.size) || 0;
      ext = extFromFilename(req.file.originalname) || extFromMimeType(req.file.mimetype);
    } else {
      if (!dataUrl) return res.status(400).json({ error: 'Missing fields' });

      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return res.status(400).json({ error: 'Invalid file data' });
      if (!allowedMimeTypes.has(parsed.mimeType)) {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      ext = extFromMimeType(parsed.mimeType);
      if (!ext) return res.status(400).json({ error: 'Unsupported file type' });

      const buffer = Buffer.from(parsed.base64Data, 'base64');
      if (buffer.length > 200 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large (max 200MB)' });
      }

      const uploadsDir = path.join(__dirname, '..', 'uploads', 'documents');
      await fs.promises.mkdir(uploadsDir, { recursive: true });

      const safeBaseName = String(name || `document.${ext}`).replace(/[^a-zA-Z0-9._ -]/g, '').trim() || `document.${ext}`;
      filename = `${Date.now()}-${safeBaseName}`.endsWith(`.${ext}`) ? `${Date.now()}-${safeBaseName}` : `${Date.now()}-${safeBaseName}.${ext}`;
      const filePath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(filePath, buffer);
      byteLength = buffer.length;
    }

    if (!filename || !ext) return res.status(400).json({ error: 'Invalid file' });

    const document = await Document.create({
      name: String(name || req.file?.originalname || filename),
      category: String(category),
      residenceId: residenceId ? String(residenceId) : null,
      type: ext.toUpperCase(),
      size: formatSize(byteLength),
      url: `/uploads/documents/${filename}`
    });

    const created = await Document.findByPk(document.id, {
      include: [{ model: Residence, attributes: ['id', 'name', 'zone'] }]
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Download a document by id
// @route   GET /api/documents/:id/download
exports.downloadDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (!document.url) return res.status(404).json({ error: 'Document file missing' });

    const filePath = safeJoinUploads(document.url);
    if (!filePath) return res.status(400).json({ error: 'Invalid document path' });

    await fs.promises.access(filePath);
    res.download(filePath, document.name);
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};

// @desc    Delete a document and its file
// @route   DELETE /api/documents/:id
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const filePath = document.url ? safeJoinUploads(document.url) : null;

    await document.destroy();

    if (filePath) {
      fs.promises.unlink(filePath).catch(() => null);
    }

    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server Error' });
  }
};
