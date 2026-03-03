const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User'); // Assuming Owner is linked to User

const Owner = sequelize.define('Owner', {
  address: {
    type: DataTypes.STRING,
  },
  // Documents can be handled via a separate table or stored as JSON if supported, 
  // but for relational integrity, a separate Document table is better.
  // For simplicity in Sequelize, we often use Associations.
}, {
  timestamps: true,
});

// Relationships
Owner.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasOne(Owner, { foreignKey: 'userId' });

module.exports = Owner;
