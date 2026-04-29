const express = require('express');
const router = express.Router();
const { protect, optionalProtect, authorizeRoles } = require('../middleware/authMiddleware');
const { ticketUpload } = require('../middleware/uploadMiddleware');
const {
  getMaintenanceCategories,
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  uploadTicketAttachment
} = require('../controllers/maintenanceController');

router.get('/categories', optionalProtect, getMaintenanceCategories);

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'), getTickets)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'), createTicket);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'), getTicket)
  .put(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'), updateTicket)
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RESIDENT'), deleteTicket);

router.route('/:id/attachment')
  .post(
    protect,
    authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'),
    ticketUpload.single('file'),
    uploadTicketAttachment
  );

module.exports = router;
