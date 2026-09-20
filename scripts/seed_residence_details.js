// Fills Residence.description and Residence.amenities (shown in the resident
// mobile app) from the Aymen Promotion Immobilière website data.
//
//   node scripts/seed_residence_details.js            -> only fills empty fields
//   node scripts/seed_residence_details.js --force    -> overwrites existing values
//   node scripts/seed_residence_details.js --dry-run  -> prints what would change
//
// Residences are matched to the website projects by accent/case-insensitive
// name. Amenities are stored as catalogue keys (see data/residenceDetails.json);
// the apps translate them (FR/EN/AR).
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { Residence } = require('../models');
const { normalizeResidenceName } = require('../utils/residenceZones');
const details = require('../data/residenceDetails.json');

// Names used in the database that differ from the website's project titles.
const ALIASES = { MORDJANE: 'EL MORDJANE' };

const findSiteEntry = (name) => {
  const key = normalizeResidenceName(name);
  const withoutPrefix = key.replace(/^RESIDENCE\s+/, '');
  return details.residences[key] || details.residences[withoutPrefix] || details.residences[ALIASES[withoutPrefix]] || null;
};

// Safe to run before the server has been restarted on this database.
const ensureAmenitiesColumn = async () => {
  const table = await sequelize.getQueryInterface().describeTable('Residence');
  if (!table.amenities) {
    await sequelize.getQueryInterface().addColumn('Residence', 'amenities', { type: DataTypes.TEXT, allowNull: true });
    console.log('Residence.amenities column added.');
  }
};

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

(async () => {
  await ensureAmenitiesColumn();
  const residences = await Residence.findAll();
  let updated = 0;
  const unmatched = [];

  for (const residence of residences) {
    const site = findSiteEntry(residence.name);
    if (!site) {
      unmatched.push(residence.name);
      continue;
    }

    const patch = {};
    if (site.description && (force || !String(residence.description || '').trim())) {
      patch.description = site.description;
    }
    if (site.amenities?.length && (force || !residence.amenities.length)) {
      patch.amenities = site.amenities;
    }
    if (!Object.keys(patch).length) continue;

    console.log(`${dryRun ? '[dry-run] ' : ''}${residence.name}: ${Object.keys(patch).join(', ')}`);
    if (!dryRun) await residence.update(patch);
    updated += 1;
  }

  console.log(`Résidences mises à jour : ${updated}/${residences.length}`);
  if (unmatched.length) console.log(`Sans équivalent sur le site : ${unmatched.join(', ')}`);
  process.exit(0);
})().catch((err) => {
  console.error('Échec:', err?.message || err);
  process.exit(1);
});
