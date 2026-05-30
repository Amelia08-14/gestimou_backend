const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  resetUserDevices
} = require('../controllers/userController');

router.route('/')
  .get(protect, authorizeRoles('ADMIN'), getUsers)
  .post(protect, authorizeRoles('ADMIN'), createUser);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN'), getUser)
  .put(protect, authorizeRoles('ADMIN'), updateUser)
  .delete(protect, authorizeRoles('ADMIN'), deleteUser);

router.route('/:id/reset-password')
  .post(protect, authorizeRoles('ADMIN'), resetUserPassword);

router.route('/:id/reset-devices')
  .delete(protect, authorizeRoles('ADMIN'), resetUserDevices);

module.exports = router;
