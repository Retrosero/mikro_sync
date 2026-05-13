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

  /**
   * SQLite tipini PostgreSQL tipine dönüştürür
   */
  sqliteTypeToPgType(sqliteType) {
    const type = (sqliteType || 'TEXT').toUpperCase();

    if (type.includes('INT')) return 'INTEGER';
    if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'DOUBLE PRECISION';
    if (type.includes('BLOB')) return 'BYTEA';
    if (type.includes('BOOL')) return 'BOOLEAN';
    if (type.includes('DATETIME') || type.includes('TIMESTAMP')) return 'TIMESTAMP';
    if (type.includes('DATE')) return 'DATE';
    if (type.includes('TIME')) return 'TIME';

    return 'TEXT';
  }

  /**
   * Tablodaki eksik kolonları kontrol eder ve ekler
   * @param {string} pgTableName - PostgreSQL tablo adı
   * @param {Array} sqliteColumns - SQLite tablo şeması (name, type vb. içeren dizi)
   */
  async ensureTableColumns(pgTableName, sqliteColumns) {
    try {
      // Mevcut kolonları al
      const pgColsResult = await this.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [pgTableName]);

      const pgColNames = pgColsResult.map(c => c.column_name);

      // SQLite'da olup PG'de olmayanları bul
      const missing = sqliteColumns.filter(sc => !pgColNames.includes(sc.name));

      if (missing.length > 0) {
        logger.info(`${pgTableName} tablosunda ${missing.length} yeni kolon tespit edildi, ekleniyor...`);

        for (const col of missing) {
          const pgType = this.sqliteTypeToPgType(col.type);
          const alterSql = `ALTER TABLE "${pgTableName}" ADD COLUMN "${col.name}" ${pgType}`;

          try {
            await this.query(alterSql);
            logger.info(`  Kolon eklendi: ${col.name} (${pgType})`);
          } catch (err) {
            logger.error(`  Kolon ekleme hatası (${col.name}): ${err.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`${pgTableName} kolon kontrolü hatası:`, error.message);
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
