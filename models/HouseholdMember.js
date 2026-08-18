const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// A household member is a person the resident (User, role RESIDENT) declares
// as living with them / having access to their unit. The resident's own
// account is always the "Primary Resident" with FULL access and is not
// stored as a row here — only the additional members are.
const HouseholdMember = sequelize.define('HouseholdMember', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  relation: {
    type: DataTypes.STRING, // Épouse, Père, Fils, ... free text
    allowNull: true,
  },
  accessLevel: {
    type: DataTypes.STRING, // FULL, RESIDENT, VISITOR, CUSTOM
    defaultValue: 'RESIDENT',
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  photo: {
    type: DataTypes.STRING, // /uploads/household/xxx.jpg
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'HouseholdMember',
});

module.exports = HouseholdMember;
