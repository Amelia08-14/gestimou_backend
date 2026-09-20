const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { getZoneFromResidenceName } = require('../utils/residenceZones');

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
  blocks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  hasBasement: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  elevatorCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  waterTankCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  generatorCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  hasSmokeExtraction: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  hasElectricCurtains: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  receptionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  hasGuardPost: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  hasVideoSurveillance: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  hasOutdoorLighting: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  logo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  hasPlayground: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // JSON-encoded array of amenity labels shown to residents ("commodités").
  amenities: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('amenities');
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
      }
    },
    set(value) {
      if (Array.isArray(value)) {
        const cleaned = value.map((v) => String(v).trim()).filter(Boolean);
        this.setDataValue('amenities', cleaned.length ? JSON.stringify(cleaned) : null);
      } else if (value == null || value === '') {
        this.setDataValue('amenities', null);
      } else {
        this.setDataValue('amenities', String(value));
      }
    },
  },
}, {
  timestamps: false, // Prisma schema doesn't have timestamps for Residence
  tableName: 'Residence',
  hooks: {
    beforeValidate: (residence) => {
      const inferredZone = getZoneFromResidenceName(residence.name);
      if (inferredZone) {
        residence.zone = inferredZone;
      }
    }
  }
});

module.exports = Residence;
