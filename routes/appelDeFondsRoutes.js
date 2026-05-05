const express = require('express');
const {
  getAppelsDeFonds,
  getAppelDeFondsById,
  createAppelDeFonds,
  updateAppelDeFonds,
  attachDocuments,
  detachDocument,
} = require('../controllers/appelDeFondsController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorizeRoles('ADMIN', 'RECOUVREMENT'));

router.route('/')
  .get(getAppelsDeFonds)
  .post(createAppelDeFonds);

router.route('/:id')
  .get(getAppelDeFondsById)
  .put(updateAppelDeFonds);

router.route('/:id/documents')
  .post(attachDocuments);

router.route('/:id/documents/:documentId')
  .delete(detachDocument);

module.exports = router;
