const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Subcontractor = sequelize.define('Subcontractor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  specialty: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Actif', // Actif, Inactif
  },
}, {
  timestamps: true,
  tableName: 'Subcontractor',
});

module.exports = Subcontractor;
