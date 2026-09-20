const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Files attached to a maintenance ticket. A ticket may hold at most
// MAX_TICKET_ATTACHMENTS files totalling MAX_TICKET_ATTACHMENTS_BYTES
// (enforced in maintenanceController).
const TicketAttachment = sequelize.define('TicketAttachment', {
  ticketId: {
    type: DataTypes.STRING, // FK MaintenanceTicket.id
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING, // /uploads/tickets/xxx.jpg
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING, // mime type
    allowNull: true,
  },
  size: {
    type: DataTypes.INTEGER, // bytes
    allowNull: false,
    defaultValue: 0,
  },
  uploadedByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  updatedAt: false,
  tableName: 'TicketAttachment',
});

module.exports = TicketAttachment;
