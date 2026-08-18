const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getAnnouncementsForStaff,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getMyAnnouncements,
  markAnnouncementRead,
} = require('../controllers/announcementController');

const STAFF = ['ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'];

router.get('/manage', protect, authorizeRoles(...STAFF), getAnnouncementsForStaff);
router.post('/', protect, authorizeRoles(...STAFF), createAnnouncement);
router.put('/:id', protect, authorizeRoles(...STAFF), updateAnnouncement);
router.delete('/:id', protect, authorizeRoles(...STAFF), deleteAnnouncement);

router.get('/', protect, getMyAnnouncements);
router.post('/:id/read', protect, markAnnouncementRead);

module.exports = router;
