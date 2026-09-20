const path = require('path');
const fs = require('fs');
const multer = require('multer');

const makeSafeFilename = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'file';

const documentAllowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const documentsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'documents');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${makeSafeFilename(file.originalname)}`)
});

const documentUpload = multer({
  storage: documentsStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!documentAllowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  }
});

const ticketsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'tickets');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const rand = Math.round(Math.random() * 1e6);
    cb(null, `${Date.now()}-${rand}-${makeSafeFilename(file.originalname)}`);
  }
});

// Ticket limits: 4 files, 10 MB for all of them together. multer only knows
// per-file limits, so the cumulative 10 MB is enforced in maintenanceController.
const MAX_TICKET_ATTACHMENTS = 4;
const MAX_TICKET_ATTACHMENTS_BYTES = 10 * 1024 * 1024;

const ticketUpload = multer({
  storage: ticketsStorage,
  limits: { fileSize: MAX_TICKET_ATTACHMENTS_BYTES, files: MAX_TICKET_ATTACHMENTS },
  fileFilter: (req, file, cb) => {
    if (!documentAllowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  }
});

// Runs a multer middleware and turns its errors into readable JSON 4xx answers.
const handleUpload = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Fichiers trop volumineux (10 Mo maximum au total).' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: `${MAX_TICKET_ATTACHMENTS} pièces jointes maximum.` });
    }
    if (err.message === 'Unsupported file type') {
      return res.status(400).json({ error: 'Type de fichier non supporté.' });
    }
    return res.status(400).json({ error: 'Erreur lors du téléversement.' });
  });
};

module.exports = {
  documentUpload,
  ticketUpload,
  handleUpload,
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_ATTACHMENTS_BYTES
};
