const { sequelize } = require('../config/db');
const {
  AppelDeFonds,
  AppelDeFondsDocument,
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

const PROMOTER_NAME = 'Aymen Promotion Immobilière';

const residenceCoverImages = {
  angelite: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=70',
  corail: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=70',
  peridot: 'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1600&q=70'
};

// [bloc, etage, lot] tel que relevé dans le canevas du parc en exploitation (PDF fournis)
const ANGELITE_LOTS = [
  ['A', 'RDC', 41], ['A', 'RDC', 42], ['A', 'RDC', 43], ['B', 'RDC', 44], ['B', 'RDC', 45],
  ['A', 'ETAGE 1', 46], ['A', 'ETAGE 1', 47], ['A', 'ETAGE 1', 48], ['B', 'ETAGE 1', 49], ['B', 'ETAGE 1', 50],
  ['A', 'ETAGE 2', 51], ['A', 'ETAGE 2', 52], ['A', 'ETAGE 2', 53], ['B', 'ETAGE 2', 54], ['B', 'ETAGE 2', 55],
  ['A', 'ETAGE 3', 56], ['A', 'ETAGE 3', 57], ['A', 'ETAGE 3', 58], ['B', 'ETAGE 3', 59], ['B', 'ETAGE 3', 60],
  ['A', 'ETAGE 4', 61], ['A', 'ETAGE 4', 62], ['A', 'ETAGE 4', 63], ['B', 'ETAGE 4', 64], ['B', 'ETAGE 4', 65],
  ['A', 'ATTIQUE', 66], ['B', 'ATTIQUE', 67], ['B', 'ATTIQUE', 68],
  ['A', 'COMBLE TERRASSE', 69], ['B', 'COMBLE TERRASSE', 70]
];

const CORAIL_LOTS = [
  [null, 'Entre-Sol 2', 74], [null, 'Entre-Sol 2', 75], [null, 'Entre-Sol 2', 76], [null, 'Entre-Sol 2', 77], [null, 'Entre-Sol 2', 78],
  [null, 'Entre-Sol 1', 79], [null, 'Entre-Sol 1', 80], [null, 'Entre-Sol 1', 81], [null, 'Entre-Sol 1', 82], [null, 'Entre-Sol 1', 83],
  [null, 'Rez-De-Chaussée', 84], [null, 'Rez-De-Chaussée', 85], [null, 'Rez-De-Chaussée', 86], [null, 'Rez-De-Chaussée', 87], [null, 'Rez-De-Chaussée', 88],
  [null, 'ÉTAGE 1', 89], [null, 'ÉTAGE 1', 90], [null, 'ÉTAGE 1', 91], [null, 'ÉTAGE 1', 92], [null, 'ÉTAGE 1', 93], [null, 'ÉTAGE 1', 94],
  [null, 'ÉTAGE 2', 95], [null, 'ÉTAGE 2', 96], [null, 'ÉTAGE 2', 97], [null, 'ÉTAGE 2', 98], [null, 'ÉTAGE 2', 99],
  [null, 'ÉTAGE 3', 100], [null, 'ÉTAGE 3', 101], [null, 'ÉTAGE 3', 102], [null, 'ÉTAGE 3', 103], [null, 'ÉTAGE 3', 104],
  [null, 'ÉTAGE 4', 105], [null, 'ÉTAGE 4', 106], [null, 'ÉTAGE 4', 107], [null, 'ÉTAGE 4', 108],
  [null, 'ATTIQUE', 109], [null, 'ATTIQUE', 110],
  [null, 'Rez-De-Chaussée', 118]
];

const PERIDOT_LOTS = [
  ['1', 'RDC', 54],
  ['1', 'ETAGE 1', 55], ['1', 'ETAGE 1', 56],
  ['1', 'ETAGE 2', 57], ['1', 'ETAGE 2', 58],
  ['1', 'ETAGE 3', 59], ['1', 'ETAGE 3', 60],
  ['1', 'ATTIQUE & COMBLE', 61], ['1', 'ATTIQUE & COMBLE', 62],
  ['1', 'ATTIQUE', 63],
  ['1', 'COMBLE', 64],
  ['2', '4EME ENTRE SOL', 65], ['2', '4EME ENTRE SOL', 66],
  ['2', '3EME ENTRE SOL', 67], ['2', '3EME ENTRE SOL', 68], ['2', '3EME ENTRE SOL', 69],
  ['2', '2EME ENTRE SOL', 70], ['2', '2EME ENTRE SOL', 71], ['2', '2EME ENTRE SOL', 72],
  ['2', '1ER ENTRE SOL', 73], ['2', '1ER ENTRE SOL', 74], ['2', '1ER ENTRE SOL', 75],
  ['2', 'REZ DE JARDIN', 76], ['2', 'REZ DE JARDIN', 77],
  ['2', 'ETAGE 1', 78], ['2', 'ETAGE 1', 79],
  ['2', 'ETAGE 2', 80], ['2', 'ETAGE 2', 81],
  ['2', 'ETAGE 3', 82], ['2', 'ETAGE 3', 83],
  ['2', 'ATTIQUE ET COMBLE', 84], ['2', 'ATTIQUE ET COMBLE', 85], ['2', 'ATTIQUE ET COMBLE', 86],
  ['1', 'RDC', 87]
];

const RESIDENCES = [
  { id: 'angelite', name: 'Angélite', zone: 'Zone 3', blocks: 'A,B', lots: ANGELITE_LOTS },
  { id: 'corail', name: 'Corail', zone: 'Zone 2', blocks: null, lots: CORAIL_LOTS },
  { id: 'peridot', name: 'Péridot', zone: 'Zone 2', blocks: '1,2', lots: PERIDOT_LOTS }
];

const assertSafeToRun = () => {
  if (String(process.env.ALLOW_DB_RESET || '').toLowerCase() !== 'true') {
    throw new Error('ALLOW_DB_RESET=true requis.');
  }
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('Refus en production.');
  }
};

const seedRealResidences = async () => {
  assertSafeToRun();

  await sequelize.authenticate();

  // type/surface ne sont pas fournis par le canevas PDF (bloc/étage/n° lot uniquement) :
  // on assouplit la contrainte NOT NULL héritée des anciennes données démo.
  await sequelize.query('ALTER TABLE `Property` MODIFY `type` VARCHAR(255) NULL');
  await sequelize.query('ALTER TABLE `Property` MODIFY `surface` FLOAT NULL');

  await sequelize.transaction(async (tx) => {
    const opts = { transaction: tx };

    // Purge des données d'exemple (résidences PRESTIGE 01/02/03 et tout ce qui leur est lié)
    await AppelDeFondsDocument.destroy({ where: {}, ...opts });
    await AppelDeFonds.destroy({ where: {}, ...opts });
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
    await AuditLog.destroy({ where: {}, ...opts });

    // Insertion des résidences réelles avec leur parc de lots (bloc/étage/n° lot) tiré des PDF
    let propertiesCreated = 0;

    for (const r of RESIDENCES) {
      await Residence.create({
        id: r.id,
        name: r.name,
        zone: r.zone,
        address: `Alger - ${r.zone}`,
        image: residenceCoverImages[r.id] || null,
        managerName: PROMOTER_NAME,
        blocks: r.blocks,
        totalUnits: r.lots.length,
        deliveredUnits: r.lots.length,
        occupancyRate: '100%'
      }, opts);

      for (const [bloc, etage, lot] of r.lots) {
        const titleParts = [bloc, String(lot)].filter(Boolean);
        await Property.create({
          title: `Appartement ${titleParts.join('-')}`,
          type: null,
          surface: null,
          floor: etage,
          block: bloc,
          lotNumber: String(lot),
          address: r.name,
          price: null,
          status: 'Occupé',
          image: null,
          residenceId: r.id,
          ownerId: null
        }, opts);
        propertiesCreated += 1;
      }
    }

    console.log('Base nettoyée des données d\'exemple et repeuplée avec le parc réel.');
    console.log(`Résidences créées: ${RESIDENCES.length} (${RESIDENCES.map((r) => r.name).join(', ')})`);
    console.log(`Lots créés: ${propertiesCreated}`);
  });
};

seedRealResidences()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('seed_real_residences_2026: échec', error);
    process.exit(1);
  });
