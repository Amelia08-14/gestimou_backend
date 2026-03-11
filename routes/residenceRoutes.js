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
  .get(protect, getResidences)
  .post(protect, admin, createResidence);

router.route('/:id')
  .get(protect, getResidence)
  .put(protect, admin, updateResidence)
  .delete(protect, admin, deleteResidence);

module.exports = router;