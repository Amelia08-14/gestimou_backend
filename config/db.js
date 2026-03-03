const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'gestimou_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
  }
);

const connectDB = async () => {
  try {
    // Create database if it doesn't exist
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({ 
        host: process.env.DB_HOST || 'localhost', 
        user: process.env.DB_USER || 'root', 
        password: process.env.DB_PASS || '' 
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'gestimou_db'}\`;`);
    await connection.end();

    await sequelize.authenticate();
    console.log('MySQL Connected...');
    // Sync models
    await sequelize.sync({ alter: true });
    console.log('Database Synced...');
  } catch (error) {
    console.error('Error connecting to MySQL:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
