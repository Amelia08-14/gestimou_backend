const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AppelDeFonds = sequelize.define('AppelDeFonds', {
  residenceId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  probleme: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  coutEstimeGlobal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  queteParProprietaire: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'DRAFT',
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  queteRassemblee: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  coutReel: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'AppelDeFonds',
});

module.exports = AppelDeFonds;
