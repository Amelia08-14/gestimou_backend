const zoneDefinitions = {
  'Zone 1': ['JAIS', 'LES CRÊTES', 'RUBIS', 'OPALE', 'EL BOUROUDJ', 'BERYL', 'PYRITE', 'RÉSIDENCE PRESTIGE', 'RESIDENCE PRESTIGE', 'PRESTIGE'],
  'Zone 2': ['COQUELICOT', 'PLUMERIA', 'CORAIL', 'PERIDOT', 'MORDJANE'],
  'Zone 3': ['SELENITE', 'SPINELLE', 'TURQUOISE', 'ÉMERAUDE', 'PERLA', 'CITRINE', 'ANGETITE']
};

const normalizeResidenceName = (value = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const zoneNameByResidence = Object.entries(zoneDefinitions).reduce((accumulator, [zone, residences]) => {
  residences.forEach((residence) => {
    accumulator[normalizeResidenceName(residence)] = zone;
  });

  return accumulator;
}, {});

const getZoneFromResidenceName = (name) => zoneNameByResidence[normalizeResidenceName(name)] || null;

module.exports = {
  zoneDefinitions,
  normalizeResidenceName,
  getZoneFromResidenceName
};
