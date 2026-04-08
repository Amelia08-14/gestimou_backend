const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { Residence, Property, Owner } = require('../models');

const toInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const pad2 = (n) => String(n).padStart(2, '0');

const seedPropertiesDemoData = async () => {
  try {
    await sequelize.authenticate();

    const perResidence = toInt(process.env.PROPERTIES_PER_RESIDENCE, 12);
    const assignEvery = toInt(process.env.PROPERTIES_ASSIGN_EVERY, 4);

    const residences = await Residence.findAll({
      attributes: ['id', 'name'],
      order: [['id', 'ASC']]
    });

    if (residences.length === 0) {
      console.log('Aucune résidence trouvée.');
      process.exit(0);
    }

    const owners = await Owner.findAll({
      attributes: ['id', 'residenceId'],
      where: { residenceId: { [Op.in]: residences.map((r) => r.id) } }
    });

    const ownersByResidence = owners.reduce((acc, o) => {
      const key = o.residenceId || '';
      if (!acc[key]) acc[key] = [];
      acc[key].push(o);
      return acc;
    }, {});

    let created = 0;
    let skipped = 0;

    for (const residence of residences) {
      const existing = await Property.findAll({
        where: {
          residenceId: residence.id,
          lotNumber: { [Op.like]: 'DEMO-%' }
        },
        attributes: ['lotNumber']
      });
      const existingLotNumbers = new Set(existing.map((p) => String(p.lotNumber || '')));

      const ownerPool = ownersByResidence[residence.id] || [];
      for (let i = 1; i <= perResidence; i += 1) {
        const lotNumber = `DEMO-${String(residence.id).toUpperCase()}-${pad2(i)}`;
        if (existingLotNumbers.has(lotNumber)) {
          skipped += 1;
          continue;
        }

        const shouldAssign = ownerPool.length > 0 && assignEvery > 0 && i % assignEvery === 0;
        const owner = shouldAssign ? ownerPool[(i / assignEvery) % ownerPool.length] : null;
        const status = owner ? 'Vendu' : 'Libre';

        const surface = 60 + ((i * 7) % 55);
        const floor = String(((i - 1) % 9) + 1);
        const block = String.fromCharCode(65 + ((i - 1) % 4));

        await Property.create({
          title: `Appartement Démo ${pad2(i)} - ${residence.name || residence.id}`,
          type: i % 6 === 0 ? 'Duplex' : 'Appartement',
          surface,
          floor,
          block,
          lotNumber,
          address: null,
          price: null,
          status,
          image: null,
          residenceId: residence.id,
          ownerId: owner ? owner.id : null
        });

        existingLotNumbers.add(lotNumber);
        created += 1;
      }
    }

    console.log(`Biens démo créés: ${created}`);
    console.log(`Biens démo déjà existants (skipped): ${skipped}`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur seed_properties_demo_data:', error);
    process.exit(1);
  }
};

seedPropertiesDemoData();

