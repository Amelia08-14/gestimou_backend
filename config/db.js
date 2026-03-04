const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

let sequelize;

// Configuration Hybride : 
// Si on est sur Windows (Local) OU si NODE_ENV est 'development', on utilise les variables du .env local
// Sinon (Linux/VPS/Prod), on utilise la config hardcodée pour s'assurer que ça marche
if (process.platform === 'win32' || process.env.NODE_ENV === 'development') {
    console.log("Using Local/Dev Database Configuration");
    sequelize = new Sequelize(
        process.env.DB_NAME || 'gestimou_db',
        process.env.DB_USER || 'root',
        process.env.DB_PASS || '',
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: 'mysql',
            logging: console.log,
        }
    );
} else {
    console.log("Using Production Database Configuration (Hardcoded for VPS)");
    sequelize = new Sequelize('gest_prod', 'gest_user', 'GestionImmo@2026.', {
        host: '127.0.0.1',
        dialect: 'mysql',
        logging: false,
    });
}

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
