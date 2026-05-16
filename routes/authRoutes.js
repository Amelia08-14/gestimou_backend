const express = require('express');
const router = express.Router();
const { login, logout, changePassword, me } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
router.put('/password', protect, changePassword);

module.exports = router;
