const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Powers two chat surfaces in the mobile app:
//  - "Report Chat": thread attached to a maintenance ticket (ticketId set)
//  - "Message Admin": general thread between a resident and the management
//    (ticketId null, userId identifies the resident the thread belongs to)
const Message = sequelize.define('Message', {
  ticketId: {
    type: DataTypes.STRING, // FK MaintenanceTicket.id, null for the general admin thread
    allowNull: true,
  },
  userId: {
    type: DataTypes.INTEGER, // the resident this thread belongs to (constant across a thread)
    allowNull: false,
  },
  senderId: {
    type: DataTypes.INTEGER, // who actually sent this message (resident or staff)
    allowNull: false,
  },
  senderRole: {
    type: DataTypes.STRING, // snapshot of sender.role at send time
    allowNull: true,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  attachments: {
    type: DataTypes.TEXT, // JSON-encoded array of { url, name, type }
    allowNull: true,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'Message',
});

module.exports = Message;
