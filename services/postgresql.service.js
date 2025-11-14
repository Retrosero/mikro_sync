const { Pool } = require('pg');
const config = require('../config/postgresql.config');
const logger = require('../utils/logger');

class PostgreSQLService {
  constructor() {
    this.pool = new Pool(config);
    
    this.pool.on('error', (err) => {
      logger.dbConnection('PostgreSQL', 'error', err);
    });
    
    this.pool.on('connect', () => {
      logger.dbConnection('PostgreSQL', 'success');
    });
  }

  async query(queryText, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('PostgreSQL sorgu hatası:', { query: queryText, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async queryOne(queryText, params = []) {
    const rows = await this.query(queryText, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async disconnect() {
    try {
      await this.pool.end();
      logger.info('PostgreSQL bağlantısı kapatıldı');
    } catch (error) {
      logger.error('PostgreSQL bağlantı kapatma hatası:', error);
    }
  }
}

module.exports = new PostgreSQLService();
