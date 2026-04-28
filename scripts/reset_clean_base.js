const { sequelize } = require('../config/db');
const {
  AuditLog,
  Document,
  FinancialTransaction,
  MaintenanceTicket,
  Notification,
  Owner,
  Property,
  RegistrationRequest,
  Residence,
  Reserve,
  User,
  UserDevice
} = require('../models');

const toInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pad2 = (n) => String(n).padStart(2, '0');

const PROMOTER_NAME = 'Aymen Promotion Immobilière';
const PROMOTER_EMAIL = 'promoteur@aymenpromotion-immobiliere.dz';

const typologyFromSurface = (surface) => {
  const s = Number(surface);
  if (!Number.isFinite(s)) return 'F2';
  if (s >= 100) return 'F4';
  if (s >= 70) return 'F3';
  return 'F2';
};

const getPropertyCountForResidence = (residenceId) => {
  if (residenceId === 'prestige-01') return 15;
  if (residenceId === 'prestige-02') return 20;
  if (residenceId === 'prestige-03') return 25;
  return toInt(process.env.PROPERTIES_PER_RESIDENCE, 12);
};

const residenceCoverById = {
  'prestige-01': 'https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1600&q=70',
  'prestige-02': 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=70',
  'prestige-03': 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=70'
};

const propertyImages = [
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=70',
  'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1200&q=70'
];

const assertSafeToRun = () => {
  if (String(process.env.ALLOW_DB_RESET || '').toLowerCase() !== 'true') {
    throw new Error('ALLOW_DB_RESET=true requis.');
  }
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('Refus en production.');
  }
};

const resetCleanBase = async () => {
  assertSafeToRun();

  await sequelize.authenticate();

  await sequelize.transaction(async (tx) => {
    const opts = { transaction: tx };

    await FinancialTransaction.destroy({ where: {}, ...opts });
    await MaintenanceTicket.destroy({ where: {}, ...opts });
    await Document.destroy({ where: {}, ...opts });
    await Reserve.destroy({ where: {}, ...opts });
    await RegistrationRequest.destroy({ where: {}, ...opts });

    await Property.destroy({ where: {}, ...opts });
    await Owner.destroy({ where: {}, ...opts });
    await Notification.destroy({ where: {}, ...opts });
    await UserDevice.destroy({ where: {}, ...opts });

    await User.destroy({ where: { role: 'RESIDENT' }, ...opts });

    await Residence.destroy({ where: {}, ...opts });

    const promoter = await Owner.create({
      firstName: 'Aymen',
      lastName: 'Promotion Immobilière',
      email: PROMOTER_EMAIL,
      status: 'Actif',
      avatar: 'AP'
    }, opts);

    const residences = [
      {
        id: 'prestige-01',
        name: 'PRESTIGE 01',
        zone: 'Zone 1',
        address: 'Alger - PRESTIGE 01',
        image: residenceCoverById['prestige-01'],
        managerName: PROMOTER_NAME,
        blocks: 'A,B,C',
        totalUnits: getPropertyCountForResidence('prestige-01')
      },
      {
        id: 'prestige-02',
        name: 'PRESTIGE 02',
        zone: 'Zone 2',
        address: 'Alger - PRESTIGE 02',
        image: residenceCoverById['prestige-02'],
        managerName: PROMOTER_NAME,
        blocks: 'A,B,C',
        totalUnits: getPropertyCountForResidence('prestige-02')
      },
      {
        id: 'prestige-03',
        name: 'PRESTIGE 03',
        zone: 'Zone 3',
        address: 'Alger - PRESTIGE 03',
        image: residenceCoverById['prestige-03'],
        managerName: PROMOTER_NAME,
        blocks: 'A,B,C',
        totalUnits: getPropertyCountForResidence('prestige-03')
      }
    ];

    for (const r of residences) {
      await Residence.create(r, opts);
    }

    for (const r of residences) {
      const perResidence = getPropertyCountForResidence(r.id);
      for (let i = 1; i <= perResidence; i += 1) {
        const floor = String(((i - 1) % 9) + 1);
        const block = String.fromCharCode(65 + ((i - 1) % 3));
        const lotNumber = pad2(i);
        const image = propertyImages[(i + r.id.length) % propertyImages.length];
        const surface = [62, 82, 108][(i - 1) % 3];
        const type = typologyFromSurface(surface);
        await Property.create({
          title: `Appartement ${pad2(i)}`,
          type,
          surface,
          floor,
          block,
          lotNumber,
          address: r.name,
          price: null,
          status: 'Libre',
          image,
          residenceId: r.id,
          ownerId: promoter.id
        }, opts);
      }
    }

    const [auditCount, userCount] = await Promise.all([
      AuditLog.count(opts),
      User.count(opts)
    ]);

    await AuditLog.destroy({ where: {}, ...opts });

    console.log('Base nettoyée et réinitialisée.');
    console.log(`Résidences créées: ${residences.length}`);
    console.log(`Biens créés: ${residences.reduce((acc, r) => acc + getPropertyCountForResidence(r.id), 0)}`);
    console.log(`Owners supprimés: all`);
    console.log(`Transactions financières supprimées: all`);
    console.log(`Tickets supprimés: all`);
    console.log(`Notifications supprimées: all`);
    console.log(`Documents supprimés: all`);
    console.log(`Devices supprimés: all`);
    console.log(`RegistrationRequests supprimées: all`);
    console.log(`Reserves supprimées: all`);
    console.log(`AuditLogs supprimés: ${auditCount}`);
    console.log(`Utilisateurs restants (non RESIDENT): ${userCount}`);
  });
};

resetCleanBase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('reset_clean_base: échec', error);
    process.exit(1);
  });
