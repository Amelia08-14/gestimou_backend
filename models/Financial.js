const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Property = require('./Property');

const Financial = sequelize.define('Financial', {
  type: {
    type: DataTypes.ENUM('Charge', 'Loyer', 'Autre'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Payé', 'Impayé', 'En attente'),
    defaultValue: 'En attente',
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  paymentDate: {
    type: DataTypes.DATE,
  },
  description: {
    type: DataTypes.STRING,
  },
}, {
  timestamps: true,
});

// Relationships
Financial.belongsTo(Property, { foreignKey: 'propertyId', onDelete: 'CASCADE' });
Property.hasMany(Financial, { foreignKey: 'propertyId' });

module.exports = Financial;
