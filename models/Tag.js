const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Tag = sequelize.define('Tag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  createdByUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  residentEmail: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  residenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  residenceName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  propertyId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transactionDescription: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'ACTIVE',
  },
}, {
  timestamps: true,
  tableName: 'Tags',
});

module.exports = Tag;
