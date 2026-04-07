const { sequelize } = require('../config/db');
const { Residence } = require('../models');
const { getZoneFromResidenceName } = require('../utils/residenceZones');

const backfillResidenceZones = async () => {
  try {
    await sequelize.authenticate();

    const residences = await Residence.findAll();
    let updatedCount = 0;

    for (const residence of residences) {
      const zone = getZoneFromResidenceName(residence.name);

      if (zone && residence.zone !== zone) {
        await residence.update({ zone });
        updatedCount += 1;
      }
    }

    console.log(`Zones mises à jour : ${updatedCount}/${residences.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors du backfill des zones :', error);
    process.exit(1);
  }
};

backfillResidenceZones();
