const sql = require('mssql');
const config = require('../config/mssql.config');
const logger = require('../utils/logger');

class MSSQLService {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      if (this.pool) {
        return this.pool;
      }
      
      this.pool = await sql.connect(config);
      logger.dbConnection('MS SQL', 'success');
      return this.pool;
    } catch (error) {
      logger.dbConnection('MS SQL', 'failed', error);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.close();
        this.pool = null;
        logger.info('MS SQL bağlantısı kapatıldı');
      }
    } catch (error) {
      logger.error('MS SQL bağlantı kapatma hatası:', error);
    }
  }

  async query(queryText, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();
      
      // Parametreleri ekle
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
      
      const result = await request.query(queryText);
      return result.recordset;
    } catch (error) {
      logger.error('MS SQL sorgu hatası:', { query: queryText, error: error.message });
      throw error;
    }
  }

  async execute(procedureName, params = {}) {
    try {
      const pool = await this.connect();
      const request = pool.request();
      
      // SESSION_CONTEXT ayarla (trigger döngüsünü önlemek için)
      await request.query("EXEC sp_set_session_context 'SYNC_ORIGIN', 'WEB'");
      
      // Parametreleri ekle
      Object.keys(params).forEach(key => {
        const value = params[key];
        if (value !== undefined && value !== null) {
          request.input(key, value);
        }
      });
      
      const result = await request.execute(procedureName);
      return result;
    } catch (error) {
      logger.error('MS SQL prosedür hatası:', { procedure: procedureName, error: error.message });
      throw error;
    }
  }

  async transaction(callback) {
    const pool = await this.connect();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new MSSQLService();
