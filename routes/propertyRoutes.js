const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty
} = require('../controllers/propertyController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'), getProperties)
  .post(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), createProperty);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER', 'RESIDENT'), getProperty)
  .put(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), updateProperty)
  .delete(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), deleteProperty);

module.exports = router;
