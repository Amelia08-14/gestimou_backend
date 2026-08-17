const express = require('express');
const router = express.Router();
const { renderResetPage, submitResetPage } = require('../controllers/passwordResetController');

router.get('/reset-password', renderResetPage);
router.post('/reset-password', submitResetPage);

module.exports = router;
