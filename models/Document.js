const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Document = sequelize.define('Document', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  relatedToModel: {
    type: DataTypes.STRING, // 'Property', 'User', 'Owner', 'Maintenance'
    allowNull: false,
  },
  relatedToId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  uploadedBy: {
    type: DataTypes.INTEGER, // User ID
  }
}, {
  timestamps: true,
});

module.exports = Document;
