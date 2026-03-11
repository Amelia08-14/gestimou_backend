const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Matches Prisma Schema:
// model User {
//   id        Int      @id @default(autoincrement())
//   email     String   @unique
//   name      String?
//   role      String   // ADMIN, MANAGER, INTERVENANT
//   profession String? // Electricien, Plombier, etc.
//   password  String?
//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt
// }

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Prisma allows null
  },
  role: {
    type: DataTypes.STRING, // Prisma uses String, not ENUM in DB (though schema has comments)
    defaultValue: 'RESIDENT',
  },
  profession: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  zone: {
    type: DataTypes.STRING, // Zone 1, Zone 2, Zone 3 (Only for Zone Managers)
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'User', // Explicit table name to match Prisma (Prisma uses pascalCase or whatever map is set, usually matches model name)
                     // Prisma default for model User is User table.
});

module.exports = User;
