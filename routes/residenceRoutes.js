const express = require('express');
const router = express.Router();
const { protect, optionalProtect, admin, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getResidences,
  getResidence,
  createResidence,
  updateResidence,
  deleteResidence,
  uploadResidenceMedia
} = require('../controllers/residenceController');

router.route('/')
  .get(optionalProtect, getResidences) // Public (dropdown) + filtered if authenticated
  .post(protect, admin, createResidence);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RECOUVREMENT', 'RESIDENT'), getResidence)
  .put(protect, admin, updateResidence)
  .delete(protect, admin, deleteResidence);

router.route('/:id/upload')
  .post(protect, admin, uploadResidenceMedia);

module.exports = router;
