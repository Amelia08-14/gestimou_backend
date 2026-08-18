const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AnnouncementRead = sequelize.define('AnnouncementRead', {
  announcementId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  readAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
  tableName: 'AnnouncementRead',
  indexes: [{ unique: true, fields: ['announcementId', 'userId'] }],
});

module.exports = AnnouncementRead;
