const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const UserDevice = sequelize.define('UserDevice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER, // User ID is INTEGER in User.js (auto-increment)
    allowNull: false,
  },
  deviceId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  deviceName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  timestamps: true,
  tableName: 'UserDevice',
  indexes: [
    {
      unique: true,
      fields: ['userId', 'deviceId']
    }
  ]
});

module.exports = UserDevice;
