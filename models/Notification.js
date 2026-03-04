const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // If null, global/role-based notification? For now, user specific is easier.
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: 'INFO' // INFO, WARNING, SUCCESS, ERROR
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  targetRole: { // Optional: if we want to target all ADMINs or INTERVENANTs
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Notification;
