const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

// Hardcoded for Production (Temporary Fix)
let sequelize = new Sequelize('gest_prod', 'gest_user', 'GestionImmo@2026.', {
    host: '127.0.0.1',
    dialect: 'mysql',
    logging: false,
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Connected...');
    
    // In production, we assume tables are managed by migrations or Prisma
    // But since we are migrating TO Sequelize, we enable sync now.
    // Be careful with alter: true on prod data.
    await sequelize.sync({ alter: true });
    console.log('Database Synced...');
    
  } catch (error) {
    console.error(`Error connecting to MySQL: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
