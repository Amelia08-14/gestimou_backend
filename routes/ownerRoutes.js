const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getOwners,
  getOwner,
  createOwner,
  updateOwner,
  updateOwnerStatus,
  deleteOwner,
  resetOwnerPassword,
  getOwnerAccount
} = require('../controllers/ownerController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), getOwners)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), createOwner);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), getOwner)
  .put(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), updateOwner)
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), deleteOwner);

router.route('/:id/status')
  .put(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), updateOwnerStatus);

router.route('/:id/account')
  .get(protect, authorizeRoles('ADMIN'), getOwnerAccount);

router.route('/:id/reset-password')
  .post(protect, authorizeRoles('ADMIN'), resetOwnerPassword);

module.exports = router;
