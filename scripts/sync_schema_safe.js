const dotenv = require('dotenv');

dotenv.config();

const { sequelize } = require('../config/db');

require('../models/index');

(async () => {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Schema synced (safe).');
  process.exit(0);
})().catch((err) => {
  console.error('Schema sync failed:', err?.message || err);
  process.exit(1);
});

