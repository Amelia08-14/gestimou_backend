const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// "Avis & Annonces" (admin-web) == "Notices" (mobile app) — the same
// official-communications feed, authored by staff and read by residents.
const Announcement = sequelize.define('Announcement', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING, // URGENT, INFO, EVENT
    defaultValue: 'INFO',
  },
  status: {
    type: DataTypes.STRING, // DRAFT, SCHEDULED, PUBLISHED, EXPIRED
    defaultValue: 'DRAFT',
  },
  residenceId: {
    type: DataTypes.STRING, // null = toutes les résidences
    allowNull: true,
  },
  blocks: {
    type: DataTypes.STRING, // comma-separated block letters, null/empty = tous les blocs
    allowNull: true,
  },
  publishAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Optional time window of the alert itself (e.g. a water cut 09:00 -> 12:00),
  // distinct from publishAt/expiresAt which only control visibility.
  startsAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  endsAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdByUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'Announcement',
});

module.exports = Announcement;
