const { sequelize } = require('../config/db');
const { Residence } = require('../models');
const { zoneDefinitions, normalizeResidenceName, getZoneFromResidenceName } = require('../utils/residenceZones');

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
  'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=60'
];

const hashToInt = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const slugifyResidenceId = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const uniqueNames = () => {
  const names = [];
  const seen = new Set();

  Object.values(zoneDefinitions).forEach((items) => {
    items.forEach((name) => {
      const key = normalizeResidenceName(name);
      if (!seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    });
  });

  return names;
};

const seedResidencesFromZones = async () => {
  try {
    await sequelize.authenticate();

    const names = uniqueNames();
    let created = 0;
    let skipped = 0;

    for (const name of names) {
      const residenceId = slugifyResidenceId(name);
      const existing = await Residence.findByPk(residenceId);

      if (existing) {
        skipped += 1;
        continue;
      }

      await Residence.create({
        id: residenceId,
        name,
        address: `Alger - ${getZoneFromResidenceName(name) || 'Zone'}`,
        image: imagePool[hashToInt(normalizeResidenceName(name)) % imagePool.length],
        totalUnits: 40 + (hashToInt(residenceId) % 161),
        deliveredUnits: 10 + (hashToInt(`${residenceId}-delivered`) % 30),
        occupancyRate: `${Math.round(((10 + (hashToInt(`${residenceId}-delivered`) % 30)) / (40 + (hashToInt(residenceId) % 161))) * 100)}%`,
        managerName: `Gestion ${getZoneFromResidenceName(name) || ''}`.trim(),
        zone: getZoneFromResidenceName(name),
        description: null
      });

      created += 1;
    }

    console.log(`Résidences créées: ${created}, déjà existantes: ${skipped}`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur seed_residences_from_zones:', error);
    process.exit(1);
  }
};

seedResidencesFromZones();
