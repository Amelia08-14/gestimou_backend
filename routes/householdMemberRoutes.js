const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
  getHouseholdMembers,
  addHouseholdMember,
  updateHouseholdMember,
  removeHouseholdMember,
} = require('../controllers/householdMemberController');

router.route('/')
  .get(protect, authorizeRoles('RESIDENT'), getHouseholdMembers)
  .post(protect, authorizeRoles('RESIDENT'), addHouseholdMember);

router.route('/:id')
  .put(protect, authorizeRoles('RESIDENT'), updateHouseholdMember)
  .delete(protect, authorizeRoles('RESIDENT'), removeHouseholdMember);

module.exports = router;
