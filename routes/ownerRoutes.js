const express = require('express');
const router = express.Router();
const {
  getOwners,
  getOwner,
  createOwner,
  updateOwner,
  deleteOwner
} = require('../controllers/ownerController');

router.route('/')
  .get(getOwners)
  .post(createOwner);

router.route('/:id')
  .get(getOwner)
  .put(updateOwner)
  .delete(deleteOwner);

module.exports = router;