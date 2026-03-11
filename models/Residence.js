const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Matches Prisma Schema:
// model Residence {
//   id             String   @id // e.g., 'cornaline', 'agate'
//   name           String
//   address        String
//   image          String?
//   totalUnits     Int
//   deliveredUnits Int      @default(0)
//   occupancyRate  String?
//   managerName    String?
//   description    String? @db.Text
//
//   properties        Property[]
//   maintenanceTickets MaintenanceTicket[]
//   financialTransactions FinancialTransaction[]
// }

const Residence = sequelize.define('Residence', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  totalUnits: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  deliveredUnits: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  occupancyRate: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  managerName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  zone: {
    type: DataTypes.STRING, // Zone 1, Zone 2, Zone 3
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: false, // Prisma schema doesn't have timestamps for Residence
  tableName: 'Residence',
});

module.exports = Residence;
