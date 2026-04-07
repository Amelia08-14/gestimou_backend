const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Matches Prisma Schema:
// model Owner {
//   id               Int      @id @default(autoincrement())
//   firstName        String
//   lastName         String
//   email            String   @unique
//   phone            String?
//   address          String?
//   status           String   @default("Actif") // Actif, Inactif
//   avatar           String?  // Initials or URL
//   totalChargesPaid Decimal  @default(0)
//   
//   // Emergency Contact
//   emergencyContactName  String?
//   emergencyContactPhone String?
//   
//   // Tracking
//   createdBy        String?
//   createdAt        DateTime @default(now())
//   updatedAt        DateTime @updatedAt
//
//   properties       Property[]
// }

const Owner = sequelize.define('Owner', {
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  residenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  block: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  floor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  doorNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parkingNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Actif',
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  totalChargesPaid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  emergencyContactName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  emergencyContactPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'Owner',
});

module.exports = Owner;
