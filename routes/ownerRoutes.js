const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getOwners,
  getOwner,
  createOwner,
  updateOwner,
  deleteOwner
} = require('../controllers/ownerController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), getOwners)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), createOwner);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), getOwner)
  .put(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), updateOwner)
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), deleteOwner);

module.exports = router;
