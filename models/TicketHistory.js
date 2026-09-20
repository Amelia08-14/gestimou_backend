const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Append-only timeline of what happened to a ticket (creation, status
// changes, assignment, information messages, attachments).
const TicketHistory = sequelize.define('TicketHistory', {
  ticketId: {
    type: DataTypes.STRING, // FK MaintenanceTicket.id
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING, // CREATED, STATUS_CHANGED, ASSIGNED, INFO_MESSAGE, ATTACHMENT_ADDED
    allowNull: false,
  },
  fromStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  toStatus: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  actorUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  actorName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  actorRole: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  updatedAt: false,
  tableName: 'TicketHistory',
  indexes: [{ fields: ['ticketId'] }],
});

module.exports = TicketHistory;
