const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { documentUpload } = require('../middleware/uploadMiddleware');
const {
  getDocuments,
  createDocument,
  downloadDocument,
  deleteDocument,
  getResidentDocuments
} = require('../controllers/documentController');

// Generic administration documents for the resident mobile app.
// Declared before '/:id/...' so 'resident' is never read as an id.
router.get('/resident', protect, authorizeRoles('RESIDENT'), getResidentDocuments);

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT'), getDocuments)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT'), documentUpload.single('file'), createDocument);

router.route('/:id/download')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT', 'RESIDENT'), downloadDocument);

router.route('/:id')
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RECOUVREMENT'), deleteDocument);

module.exports = router;
