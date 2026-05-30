const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { createTag, getTags } = require('../controllers/tagController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN', 'GESTIONNAIRE_TAG', 'RECOUVREMENT'), getTags)
  .post(protect, authorizeRoles('ADMIN', 'GESTIONNAIRE_TAG'), createTag);

module.exports = router;
