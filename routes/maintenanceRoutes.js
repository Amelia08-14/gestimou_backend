const express = require('express');
const router = express.Router();
const { protect, optionalProtect, authorizeRoles } = require('../middleware/authMiddleware');
const { ticketUpload, handleUpload, MAX_TICKET_ATTACHMENTS } = require('../middleware/uploadMiddleware');
const {
  getMaintenanceCategories,
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  uploadTicketAttachment,
  uploadTicketAttachments,
  deleteTicketAttachment,
  getTicketHistory
} = require('../controllers/maintenanceController');

router.get('/categories', optionalProtect, getMaintenanceCategories);

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'), getTickets)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'), createTicket);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'), getTicket)
  .put(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'), updateTicket)
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'RESIDENT'), deleteTicket);

router.get(
  '/:id/history',
  protect,
  authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'HSE', 'INTERVENANT', 'RESIDENT'),
  getTicketHistory
);

// Legacy single-file upload (field "file"), still used by older admin-web builds.
router.route('/:id/attachment')
  .post(
    protect,
    authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'),
    handleUpload(ticketUpload.single('file')),
    uploadTicketAttachment
  );

// Up to 4 files / 10 MB total per ticket (multipart field "files").
router.route('/:id/attachments')
  .post(
    protect,
    authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'),
    handleUpload(ticketUpload.array('files', MAX_TICKET_ATTACHMENTS)),
    uploadTicketAttachments
  );

router.route('/:id/attachments/:attachmentId')
  .delete(
    protect,
    authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'),
    deleteTicketAttachment
  );

module.exports = router;
