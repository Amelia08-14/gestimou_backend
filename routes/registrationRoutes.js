const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  submitRequest,
  getRequests,
  approveRequest,
  rejectRequest
} = require('../controllers/registrationController');

router.post('/', submitRequest); // Public (Mobile App)
router.get('/', protect, admin, getRequests); // Admin Dashboard
router.post('/:id/approve', protect, admin, approveRequest); // Admin Action
router.post('/:id/reject', protect, admin, rejectRequest); // Admin Action

module.exports = router;
