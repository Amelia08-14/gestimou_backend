const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  submitPropertyAddRequest,
  getPropertyAddRequests,
  approvePropertyAddRequest,
  rejectPropertyAddRequest,
} = require('../controllers/propertyAddRequestController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), getPropertyAddRequests)
  .post(protect, authorizeRoles('RESIDENT'), submitPropertyAddRequest);

router.post('/:id/approve', protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), approvePropertyAddRequest);
router.post('/:id/reject', protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), rejectPropertyAddRequest);

module.exports = router;

