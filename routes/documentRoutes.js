const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { documentUpload } = require('../middleware/uploadMiddleware');
const {
  getDocuments,
  createDocument,
  downloadDocument,
  deleteDocument
} = require('../controllers/documentController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT'), getDocuments)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT'), documentUpload.single('file'), createDocument);

router.route('/:id/download')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT'), downloadDocument);

router.route('/:id')
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT'), deleteDocument);

module.exports = router;
