const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Property = require('./Property');
const User = require('./User');

const Maintenance = sequelize.define('Maintenance', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Signalé', 'En cours', 'Terminé', 'Annulé'),
    defaultValue: 'Signalé',
  },
  priority: {
    type: DataTypes.ENUM('Basse', 'Moyenne', 'Haute', 'Urgent'),
    defaultValue: 'Moyenne',
  },
  interventionDate: {
    type: DataTypes.DATE,
  },
  cost: {
    type: DataTypes.FLOAT,
  },
}, {
  timestamps: true,
});

// Relationships
Maintenance.belongsTo(Property, { foreignKey: 'propertyId' });
Property.hasMany(Maintenance, { foreignKey: 'propertyId' });

Maintenance.belongsTo(User, { as: 'requestedBy', foreignKey: 'requesterId' });

module.exports = Maintenance;
