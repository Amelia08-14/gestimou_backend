const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Matches Prisma Schema:
// model Document {
//   id        Int      @id @default(autoincrement())
//   name      String
//   type      String   // PDF, DOCX
//   size      String
//   category  String   // Contrats, Factures, Sécurité, SAV
//   url       String?  // Path to file
//   createdAt DateTime @default(now())
// }

const Document = sequelize.define('Document', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  size: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  residenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  updatedAt: false, // Prisma schema only has createdAt
  tableName: 'Document',
});

module.exports = Document;
