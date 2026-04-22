const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Matches Prisma Schema:
// model MaintenanceTicket {
//   id          String   @id @default(uuid()) // T-1023
//   title       String
//   description String   @db.Text
//   priority    String   // Basse, Moyenne, Haute, Urgent
//   status      String   // Signalé, En cours, Terminé
//   category    String?  // Ascenseur, Eclairage, etc.
//   location    String   // Parties Communes
//   requester   String
//   assignee    String?
//   createdAt   DateTime @default(now())
//   updatedAt   DateTime @updatedAt
//   
//   residenceId String?
//   residence   Residence? @relation(fields: [residenceId], references: [id])
// }

const MaintenanceTicket = sequelize.define('MaintenanceTicket', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  priority: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  requester: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: { // Email of the requester
    type: DataTypes.STRING,
    allowNull: true,
  },
  assignee: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  residenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Subcontractor Management
  subcontractorId: {
    type: DataTypes.UUID, // Using UUID for consistency, constraint disabled in index.js to prevent errno 150
    allowNull: true,
  },
  interventionDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  deadline: {
    type: DataTypes.DATE, // Deadline for completion
    allowNull: true,
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  paymentStatus: {
    type: DataTypes.STRING, // Payé, En attente, Non facturé
    defaultValue: 'Non facturé',
  },
  attachmentUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  attachmentName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  attachmentType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  attachmentSize: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'MaintenanceTicket',
});

module.exports = MaintenanceTicket;
