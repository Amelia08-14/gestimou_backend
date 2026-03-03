const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Owner = require('./Owner');

// Matches Prisma Schema:
// model Property {
//   id          Int      @id @default(autoincrement())
//   title       String
//   type        String   // Appartement, Duplex, etc.
//   surface     Float
//   floor       String?
//   block       String?
//   lotNumber   String?
//   address     String?  // Specific address if needed beyond residence
//   price       Decimal? // Monthly charges or price
//   status      String   // Libre, Occupé, Vendu
//   image       String?
//   residenceId String
//   ownerId     Int?
//   ...
// }

const Property = sequelize.define('Property', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  surface: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  floor: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  block: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  lotNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'Libre',
  },
  image: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  residenceId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'Property',
});

// Relationships need to match Prisma foreign keys if we want Sequelize to query them correctly
// Prisma uses `ownerId` column. Sequelize `belongsTo` uses foreignKey option.
// Property.belongsTo(Owner, { foreignKey: 'ownerId' });
// Owner.hasMany(Property, { foreignKey: 'ownerId' });

module.exports = Property;
