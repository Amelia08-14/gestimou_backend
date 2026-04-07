const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

let sequelize;

// Configuration Hybride Améliorée :
// 1. Si les variables d'environnement (DB_USER, etc.) sont définies, on les utilise en priorité.
// 2. Sinon, si on est sur Linux (VPS), on utilise la configuration de production par défaut (Hardcoded).
// 3. Sinon (Windows/Dev local sans .env), on utilise la config locale par défaut (root sans mot de passe).

const hasEnvVars = process.env.DB_USER && process.env.DB_NAME;
const isLinux = process.platform !== 'win32';

if (hasEnvVars) {
    console.log("Using Database Configuration from Environment Variables");
    sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: 'mysql',
            logging: console.log,
        }
    );
} else if (isLinux) {
    console.log("Using Production Database Configuration (Hardcoded for VPS - Fallback)");
    sequelize = new Sequelize('gest_prod', 'gest_user', 'GestionImmo@2026.', {
        host: '127.0.0.1',
        dialect: 'mysql',
        logging: false,
    });
} else {
    console.log("Using Local Default Database Configuration (No .env found)");
    sequelize = new Sequelize('gestimou_db', 'root', '', {
        host: 'localhost',
        dialect: 'mysql',
        logging: console.log,
    });
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Connected...');
    
    const shouldSync =
      process.env.DB_SYNC === 'true' ||
      process.env.SYNC_DB === 'true' ||
      process.env.NODE_ENV !== 'production';

    if (shouldSync) {
      try {
        await sequelize.sync({ alter: true });
        console.log('Database Synced...');
      } catch (syncError) {
        if (syncError.name === 'SequelizeUnknownConstraintError' ||
            syncError.original?.code === 'ER_DUP_KEYNAME' ||
            syncError.original?.code === 'ER_DUP_FIELDNAME' ||
            syncError.original?.code === 'ER_CANT_CREATE_TABLE') {
          console.warn('⚠️ Warning: Sync issue ignored (Constraint/Index/Column/FK). The server will continue starting.');
          console.warn(`Details: ${syncError.message}`);
        } else {
          throw syncError;
        }
      }
    } else {
      console.log('Database Sync skipped (production mode).');
    }
    
  } catch (error) {
    console.error(`Error connecting to MySQL: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
