/**
 * SQLite Service - Ana Entegra db.s3db için
 * Better-sqlite3 kullanarak senkron veritabanı erişimi sağlar
 */

const Database = require('better-sqlite3');
const logger = require('../utils/logger');

class SQLiteService {
    constructor() {
        this.db = null;
        this.dbPath = 'C:\\Ana Entegra\\db.s3db';
    }

    /**
     * Veritabanı bağlantısını aç
     * @param {boolean} readonly - Salt okunur mod
     */
    connect(readonly = false) {
        if (this.db) {
            return this.db;
        }

        try {
            this.db = new Database(this.dbPath, { readonly });
            logger.info(`SQLite bağlantısı açıldı: ${this.dbPath} (readonly: ${readonly})`);
            return this.db;
        } catch (error) {
            logger.error('SQLite bağlantı hatası:', error);
            throw error;
        }
    }

    /**
     * Veritabanı bağlantısını kapat
     */
    disconnect() {
        if (this.db) {
            this.db.close();
            this.db = null;
            logger.info('SQLite bağlantısı kapatıldı');
        }
    }

    /**
     * SQL sorgusu çalıştır ve tüm sonuçları döndür
     * @param {string} sql - SQL sorgusu
     * @param {Array} params - Parametreler
     */
    query(sql, params = []) {
        this.ensureConnection();
        try {
            const stmt = this.db.prepare(sql);
            return stmt.all(...params);
        } catch (error) {
            logger.error('SQLite sorgu hatası:', { sql, error: error.message });
            throw error;
        }
    }

    /**
     * SQL sorgusu çalıştır ve tek sonuç döndür
     * @param {string} sql - SQL sorgusu
     * @param {Array} params - Parametreler
     */
    queryOne(sql, params = []) {
        this.ensureConnection();
        try {
            const stmt = this.db.prepare(sql);
            return stmt.get(...params);
        } catch (error) {
            logger.error('SQLite sorgu hatası:', { sql, error: error.message });
            throw error;
        }
    }

    /**
     * INSERT/UPDATE/DELETE çalıştır
     * @param {string} sql - SQL sorgusu
     * @param {Array} params - Parametreler
     */
    run(sql, params = []) {
        this.ensureConnection(false);
        try {
            const stmt = this.db.prepare(sql);
            return stmt.run(...params);
        } catch (error) {
            logger.error('SQLite run hatası:', { sql, error: error.message });
            throw error;
        }
    }

    /**
     * Tablo şemasını al
     * @param {string} tableName - Tablo adı
     */
    getTableSchema(tableName) {
        this.ensureConnection();
        return this.query(`PRAGMA table_info('${tableName}')`);
    }

    /**
     * Tablodaki kayıt sayısını al
     * @param {string} tableName - Tablo adı
     */
    getRowCount(tableName) {
        this.ensureConnection();
        const result = this.queryOne(`SELECT COUNT(*) as count FROM '${tableName}'`);
        return result ? result.count : 0;
    }

    /**
     * Bağlantının açık olduğundan emin ol
     */
    ensureConnection(readonly = true) {
        if (!this.db) {
            this.connect(readonly);
        }
    }
}

module.exports = new SQLiteService();
