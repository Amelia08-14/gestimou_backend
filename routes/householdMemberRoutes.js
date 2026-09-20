const express = require('express');
const router = express.Router();
const { protect, authorizeRoles, requirePrimaryResident } = require('../middleware/authMiddleware');
const {
  getHouseholdMembers,
  addHouseholdMember,
  updateHouseholdMember,
  removeHouseholdMember,
  resendMemberAccess,
} = require('../controllers/householdMemberController');

// Household members (accounts created through a household) can't manage it:
// only the primary resident can add, edit or remove members.
router.route('/')
  .get(protect, authorizeRoles('RESIDENT'), requirePrimaryResident, getHouseholdMembers)
  .post(protect, authorizeRoles('RESIDENT'), requirePrimaryResident, addHouseholdMember);

router.route('/:id')
  .put(protect, authorizeRoles('RESIDENT'), requirePrimaryResident, updateHouseholdMember)
  .delete(protect, authorizeRoles('RESIDENT'), requirePrimaryResident, removeHouseholdMember);

router.post('/:id/resend-access', protect, authorizeRoles('RESIDENT'), requirePrimaryResident, resendMemberAccess);

module.exports = router;
