const express = require('express');
const router = express.Router();
const { login, logout, changePassword, me, updatePhoto, removePhoto } = require('../controllers/authController');
const { forgotPassword, resetPassword } = require('../controllers/passwordResetController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
router.put('/password', protect, changePassword);
router.put('/photo', protect, updatePhoto);
router.delete('/photo', protect, removePhoto);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
