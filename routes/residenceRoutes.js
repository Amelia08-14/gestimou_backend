const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const {
  getResidences,
  getResidence,
  createResidence,
  updateResidence,
  deleteResidence
} = require('../controllers/residenceController');

router.route('/')
  .get(getResidences) // Allow public access for registration dropdown
  .post(protect, admin, createResidence);

router.route('/:id')
  .get(protect, getResidence)
  .put(protect, admin, updateResidence)
  .delete(protect, admin, deleteResidence);

module.exports = router;