const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTicketMessages, sendTicketMessage, sendTicketInfo } = require('../controllers/messageController');

router.get('/ticket/:ticketId', protect, getTicketMessages);
router.post('/ticket/:ticketId', protect, sendTicketMessage);
router.post('/ticket/:ticketId/info', protect, sendTicketInfo);

module.exports = router;
