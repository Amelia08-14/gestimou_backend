const { sequelize } = require('../config/db');
const { Residence } = require('../models');
const { getZoneFromResidenceName } = require('../utils/residenceZones');

const imagePool = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1527030280862-64139fba04ca?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1560185008-b033106af5d6?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1544984243-ec57ea16fe25?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1529408632839-a54952c491e5?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=60',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=60'
];

const hashToInt = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const computeDemoMetrics = (residence) => {
  const base = hashToInt(residence.id || residence.name || '');
  const totalUnits = 40 + (base % 161);
  const deliveredUnits = Math.min(totalUnits, Math.floor(totalUnits * ((base % 71) / 100)));
  const occupancyRate = totalUnits > 0 ? `${Math.round((deliveredUnits / totalUnits) * 100)}%` : null;
  return { totalUnits, deliveredUnits, occupancyRate };
};

const backfillResidenceDemoData = async () => {
  try {
    await sequelize.authenticate();

    const residences = await Residence.findAll({ order: [['id', 'ASC']] });
    let updated = 0;

    for (const residence of residences) {
      const inferredZone = getZoneFromResidenceName(residence.name) || residence.zone || null;
      const metrics = computeDemoMetrics(residence);
      const image = imagePool[hashToInt(residence.id) % imagePool.length];

      const patch = {};

      if (!residence.zone && inferredZone) patch.zone = inferredZone;
      if (!residence.image) patch.image = image;

      if (!residence.address || residence.address === 'À renseigner') {
        patch.address = inferredZone ? `Alger - ${inferredZone}` : 'Alger, Algérie';
      }

      if (!residence.managerName) {
        patch.managerName = inferredZone ? `Gestion ${inferredZone}` : 'Gestion';
      }

      if (!residence.totalUnits || residence.totalUnits === 0) patch.totalUnits = metrics.totalUnits;
      if (!residence.deliveredUnits || residence.deliveredUnits === 0) patch.deliveredUnits = metrics.deliveredUnits;
      if (!residence.occupancyRate) patch.occupancyRate = metrics.occupancyRate;

      if (Object.keys(patch).length > 0) {
        await residence.update(patch);
        updated += 1;
      }
    }

    console.log(`Résidences mises à jour (démo): ${updated}/${residences.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur seed_residence_demo_data:', error);
    process.exit(1);
  }
};

backfillResidenceDemoData();
