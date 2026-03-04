const User = require('./User');
const Property = require('./Property');
const Owner = require('./Owner');
const Residence = require('./Residence');
const MaintenanceTicket = require('./Maintenance'); // Filename is Maintenance.js but model is MaintenanceTicket
const FinancialTransaction = require('./Financial'); // Filename is Financial.js
const Document = require('./Document');
const Reserve = require('./Reserve');

// Define Associations

// Residence <-> Property
Residence.hasMany(Property, { foreignKey: 'residenceId' });
Property.belongsTo(Residence, { foreignKey: 'residenceId' });

// Owner <-> Property
Owner.hasMany(Property, { foreignKey: 'ownerId' });
Property.belongsTo(Owner, { foreignKey: 'ownerId', as: 'owner' });

// Residence <-> MaintenanceTicket
Residence.hasMany(MaintenanceTicket, { foreignKey: 'residenceId' });
MaintenanceTicket.belongsTo(Residence, { foreignKey: 'residenceId' });

// Residence <-> FinancialTransaction
Residence.hasMany(FinancialTransaction, { foreignKey: 'residenceId' });
FinancialTransaction.belongsTo(Residence, { foreignKey: 'residenceId' });

// Property <-> FinancialTransaction
Property.hasMany(FinancialTransaction, { foreignKey: 'propertyId' });
FinancialTransaction.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Owner <-> Property (Nested for Financial)
// Already defined above

// Residence <-> FinancialTransactionReserve
Property.hasMany(Reserve, { foreignKey: 'propertyId' });
Reserve.belongsTo(Property, { foreignKey: 'propertyId' });


const Notification = require('./Notification');

// Notification Associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

module.exports = {
  User,
  Property,
  Owner,
  Residence,
  MaintenanceTicket,
  FinancialTransaction,
  Document,
  Reserve,
  Notification,
};
