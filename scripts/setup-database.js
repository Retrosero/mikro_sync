const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

async function setupPostgreSQL() {
  logger.info('PostgreSQL setup başlıyor...');
  
  const sqlFile = await fs.readFile(
    path.join(__dirname, 'sql', 'postgresql-setup.sql'), 
    'utf8'
  );
  
  const statements = sqlFile.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await pgService.query(statement);
      } catch (error) {
        logger.error('PostgreSQL setup hatası:', error.message);
      }
    }
  }
  
  logger.info('PostgreSQL setup tamamlandı');
}

async function setupMSSQL() {
  logger.info('MS SQL setup başlıyor...');
  
  const sqlFile = await fs.readFile(
    path.join(__dirname, 'sql', 'mssql-setup.sql'), 
    'utf8'
  );
  
  const statements = sqlFile.split('GO').filter(s => s.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await mssqlService.query(statement);
      } catch (error) {
        logger.error('MS SQL setup hatası:', error.message);
      }
    }
  }
  
  logger.info('MS SQL setup tamamlandı');
}

async function main() {
  try {
    await setupPostgreSQL();
    await setupMSSQL();
    logger.info('Tüm veritabanı kurulumları tamamlandı');
    process.exit(0);
  } catch (error) {
    logger.error('Setup hatası:', error);
    process.exit(1);
  }
}

main();
