const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const { downloadBackup, restoreBackup } = require('../controllers/adminController');

router.get('/backup', protect, admin, downloadBackup);
router.post('/restore', protect, admin, restoreBackup);

module.exports = router;

