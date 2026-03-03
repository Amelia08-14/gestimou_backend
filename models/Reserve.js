const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Matches Prisma Schema:
// model Reserve {
//   id          Int      @id @default(autoincrement())
//   description String   @db.Text
//   status      String   // Non traité, En cours, Traité
//   severity    String   // Mineur, Majeur, Critique
//   photo       String?
//   
//   propertyId  Int
//   property    Property @relation(fields: [propertyId], references: [id])
//   
//   createdAt   DateTime @default(now())
//   updatedAt   DateTime @updatedAt
// }

const Reserve = sequelize.define('Reserve', {
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  severity: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  propertyId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'Reserve',
});

module.exports = Reserve;
