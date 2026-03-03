const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Owner = require('./Owner');

const Property = sequelize.define('Property', {
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  project: {
    type: DataTypes.STRING,
  },
  block: {
    type: DataTypes.STRING,
  },
  floor: {
    type: DataTypes.STRING,
  },
  lotNumber: {
    type: DataTypes.STRING,
  },
  housingType: {
    type: DataTypes.STRING, // 'Type de logement'
  },
  type: {
    type: DataTypes.ENUM('Appartement', 'Duplex', 'Penthouse', 'Autre'),
    allowNull: false,
  },
  surface: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Libre', 'Loué', 'Vendu'),
    defaultValue: 'Libre',
  },
  // Photos and Documents are better in separate tables or JSON if simple URLs
  photos: {
    type: DataTypes.JSON, // Stores array of strings
  },
}, {
  timestamps: true,
});

// Relationships
Property.belongsTo(Owner, { foreignKey: 'ownerId' });
Owner.hasMany(Property, { foreignKey: 'ownerId' });

module.exports = Property;
