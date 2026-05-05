const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { getSubcontractors } = require('../controllers/subcontractorController');

router.get('/', protect, authorizeRoles('ADMIN', 'MANAGER', 'RESPONSABLE_ZONE'), getSubcontractors);

module.exports = router;

