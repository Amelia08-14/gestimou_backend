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

// Ids of the primary resident and of every account created through their household.
const getHouseholdUserIds = async (user) => {
  const primary = await getEffectiveResidentUser(user);
  if (!primary) return [];
  const members = await User.findAll({ where: { householdOwnerId: primary.id }, attributes: ['id'] });
  return [primary.id, ...members.map((m) => m.id)];
};

module.exports = { getEffectiveResidentUser, getEffectiveResidentEmail, getHouseholdUserIds };
