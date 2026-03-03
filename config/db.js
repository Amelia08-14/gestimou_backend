const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

let sequelize;

if (process.env.DATABASE_URL) {
    console.log("Using DATABASE_URL connection string");
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'mysql',
        logging: false,
    });
} else {
    console.log("Using individual DB variables");
    sequelize = new Sequelize(
    process.env.DB_NAME || 'gest_prod',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || 'localhost',
      dialect: 'mysql',
      logging: false,
    }
  );
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
    console.error('Error connecting to MySQL:', error);
  }
};

module.exports = { sequelize, connectDB };
