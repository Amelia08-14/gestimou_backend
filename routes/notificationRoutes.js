const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead, createNotification } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getNotifications);
router.post('/', protect, createNotification); 
router.put('/read-all', protect, markAllAsRead); // Must come before /:id/read to avoid conflict if :id catches "read-all"
router.put('/:id/read', protect, markAsRead);

module.exports = router;
