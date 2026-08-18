const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getTicketMessages,
  sendTicketMessage,
  getAdminMessages,
  sendAdminMessage,
} = require('../controllers/messageController');

router.get('/ticket/:ticketId', protect, getTicketMessages);
router.post('/ticket/:ticketId', protect, sendTicketMessage);
router.get('/admin', protect, getAdminMessages);
router.post('/admin', protect, sendAdminMessage);

module.exports = router;
