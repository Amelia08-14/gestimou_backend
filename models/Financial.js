const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Matches Prisma Schema:
// model FinancialTransaction {
//   id          Int      @id @default(autoincrement())
//   type        String   // Charge, Dépense
//   description String
//   amount      Decimal
//   status      String   // Payé, En attente
//   date        DateTime
//   
//   // Relations
//   residenceId String?
//   residence   Residence? @relation(fields: [residenceId], references: [id])
//   
//   propertyId  Int?
//   property    Property? @relation(fields: [propertyId], references: [id])
//   
//   createdAt   DateTime @default(now())
//   updatedAt   DateTime @updatedAt
// }

const FinancialTransaction = sequelize.define('FinancialTransaction', {
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  periodStart: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  periodEnd: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  residenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  propertyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  expenseCategory: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  documentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'FinancialTransaction',
});

module.exports = FinancialTransaction;
