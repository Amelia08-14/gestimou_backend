const express = require('express');
const router = express.Router();
const {
  getResidences,
  getResidence,
  createResidence,
  updateResidence,
  deleteResidence
} = require('../controllers/residenceController');

router.route('/')
  .get(getResidences)
  .post(createResidence);

router.route('/:id')
  .get(getResidence)
  .put(updateResidence)
  .delete(deleteResidence);

module.exports = router;