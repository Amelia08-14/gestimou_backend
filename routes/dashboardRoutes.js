const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getDashboardStats
} = require('../controllers/dashboardController');

router.route('/').get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'RECOUVREMENT', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'), getDashboardStats);

module.exports = router;
