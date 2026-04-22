const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser
} = require('../controllers/userController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN'), getUsers)
  .post(protect, authorizeRoles('ADMIN'), createUser);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN'), getUser)
  .put(protect, authorizeRoles('ADMIN'), updateUser)
  .delete(protect, authorizeRoles('ADMIN'), deleteUser);

module.exports = router;
