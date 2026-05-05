const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AppelDeFondsDocument = sequelize.define('AppelDeFondsDocument', {
  appelDeFondsId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  documentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  phase: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'BEFORE',
  },
}, {
  timestamps: true,
  tableName: 'AppelDeFondsDocument',
});

module.exports = AppelDeFondsDocument;
