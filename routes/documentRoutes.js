const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { documentUpload } = require('../middleware/uploadMiddleware');
const {
  getDocuments,
  createDocument,
  downloadDocument,
  deleteDocument
} = require('../controllers/documentController');

router.route('/')
  .get(protect, admin, getDocuments)
  .post(protect, admin, documentUpload.single('file'), createDocument);

router.route('/:id/download')
  .get(protect, admin, downloadDocument);

router.route('/:id')
  .delete(protect, admin, deleteDocument);

module.exports = router;
