const User = require('./User');
const Property = require('./Property');
const Owner = require('./Owner');
const Residence = require('./Residence');
const MaintenanceTicket = require('./Maintenance'); // Filename is Maintenance.js but model is MaintenanceTicket
const FinancialTransaction = require('./Financial'); // Filename is Financial.js
const Document = require('./Document');
const Reserve = require('./Reserve');
const Notification = require('./Notification');
const Subcontractor = require('./Subcontractor');
const RegistrationRequest = require('./RegistrationRequest');
const UserDevice = require('./UserDevice');

// Define Associations

// User <-> UserDevice
User.hasMany(UserDevice, { foreignKey: 'userId', as: 'devices' });
UserDevice.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// RegistrationRequest <-> Residence (Optional, usually just ID string, but good for joins)
// RegistrationRequest.belongsTo(Residence, { foreignKey: 'residenceId' });

// Residence <-> Property
Residence.hasMany(Property, { foreignKey: 'residenceId' });
Property.belongsTo(Residence, { foreignKey: 'residenceId' });

// Owner <-> Property
Owner.hasMany(Property, { foreignKey: 'ownerId' });
Property.belongsTo(Owner, { foreignKey: 'ownerId', as: 'owner' });

// Residence <-> Owner
Residence.hasMany(Owner, { foreignKey: 'residenceId', as: 'owners' });
Owner.belongsTo(Residence, { foreignKey: 'residenceId', as: 'residence' });

// Residence <-> MaintenanceTicket
Residence.hasMany(MaintenanceTicket, { foreignKey: 'residenceId' });
MaintenanceTicket.belongsTo(Residence, { foreignKey: 'residenceId', as: 'residence' });

// Subcontractor <-> MaintenanceTicket
Subcontractor.hasMany(MaintenanceTicket, { foreignKey: 'subcontractorId', constraints: false });
MaintenanceTicket.belongsTo(Subcontractor, { foreignKey: 'subcontractorId', as: 'subcontractor', constraints: false });

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


// Notification Associations
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// Residence <-> Document
Residence.hasMany(Document, { foreignKey: 'residenceId' });
Document.belongsTo(Residence, { foreignKey: 'residenceId' });

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
  Subcontractor,
  RegistrationRequest,
  UserDevice,
};
