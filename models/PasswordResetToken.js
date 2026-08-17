const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Stores only a hash of the reset token (never the raw value) so a DB leak
// alone can't be used to reset accounts. Raw token only ever exists in the
// emailed link and briefly in memory while handling the request.
const PasswordResetToken = sequelize.define('PasswordResetToken', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  tokenHash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'PasswordResetToken',
});

module.exports = PasswordResetToken;
