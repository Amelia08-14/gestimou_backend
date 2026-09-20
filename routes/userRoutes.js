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
  resetUserDevices,
  setUserStatus
} = require('../controllers/userController');

router.route('/')
  // Listing is also needed by RESPONSABLE_ZONE/MANAGER to pick a
  // responsible/intervenant when assigning tickets (mobile + admin-web
  // maintenance screens) — password is already excluded from the response.
  // Creating staff accounts stays ADMIN-only.
  .get(protect, authorizeRoles('ADMIN', 'RESPONSABLE_ZONE', 'MANAGER'), getUsers)
  .post(protect, authorizeRoles('ADMIN'), createUser);

router.route('/:id')
  .get(protect, authorizeRoles('ADMIN'), getUser)
  .put(protect, authorizeRoles('ADMIN'), updateUser)
  .delete(protect, authorizeRoles('ADMIN'), deleteUser);

router.route('/:id/reset-password')
  .post(protect, authorizeRoles('ADMIN'), resetUserPassword);

router.route('/:id/status')
  .put(protect, authorizeRoles('ADMIN'), setUserStatus);

router.route('/:id/reset-devices')
  .delete(protect, authorizeRoles('ADMIN'), resetUserDevices);

module.exports = router;
