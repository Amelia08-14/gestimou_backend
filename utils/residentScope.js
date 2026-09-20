const { User } = require('../models');

// A household member logs in with their own account (User.householdOwnerId set)
// but lives in the primary resident's unit: properties, charges, tickets and
// notices are all resolved through the primary resident's e-mail (Owner.email).
const getEffectiveResidentUser = async (user) => {
  if (!user?.householdOwnerId) return user;
  const primary = await User.findByPk(user.householdOwnerId);
  return primary || user;
};

const getEffectiveResidentEmail = async (user) => {
  const resident = await getEffectiveResidentUser(user);
  return String(resident?.email || '').trim().toLowerCase();
};

module.exports = { getEffectiveResidentUser, getEffectiveResidentEmail };
