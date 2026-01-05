/**
 * Ana Entegra db.s3db SQLite veritabanı yapısını inceler
 * ve hedef tabloların şemasını JSON olarak kaydeder
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// db.s3db yolu
const DB_PATH = 'C:\\Ana Entegra\\db.s3db';

// Hedef tablolar
const TARGET_TABLES = [
    'order',
    'order_status',
    'order_product',
    'pictures',
    'product_quantity',
    'product_prices',
    'product',
    'product_info',
    'messages',
    'message_template'
];

function exploreDatabase() {
    const result = {
        allTables: [],
        targetTables: {},
        createStatements: []
    };

    let db;
    try {
        db = new Database(DB_PATH, { readonly: true });

        // Tüm tabloları listele
        const allTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `).all();

        result.allTables = allTables.map(t => t.name);

        // Hedef tabloları analiz et
        for (const tableName of TARGET_TABLES) {
            const tableExists = allTables.find(t => t.name === tableName);

            if (!tableExists) {
                result.targetTables[tableName] = { exists: false };
                continue;
            }

            // Tablo şemasını al
            const columns = db.prepare(`PRAGMA table_info('${tableName}')`).all();

            // Satır sayısını al
            const countResult = db.prepare(`SELECT COUNT(*) as count FROM '${tableName}'`).get();

            // Örnek veri
            let sample = null;
            if (countResult.count > 0) {
                sample = db.prepare(`SELECT * FROM '${tableName}' LIMIT 1`).get();
            }

            result.targetTables[tableName] = {
                exists: true,
                columns: columns,
                rowCount: countResult.count,
                sample: sample
            };

            // PostgreSQL CREATE TABLE ifadesi oluştur
            const pgTableName = `entegra_${tableName}`;

            const colDefs = columns.map(col => {
                let pgType = 'TEXT';
                const type = (col.type || 'TEXT').toUpperCase();

                if (type.includes('INT')) pgType = 'INTEGER';
                else if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) pgType = 'DOUBLE PRECISION';
                else if (type.includes('BLOB')) pgType = 'BYTEA';
                else if (type.includes('BOOL')) pgType = 'BOOLEAN';
                else if (type.includes('DATE') || type.includes('TIME')) pgType = 'TIMESTAMP';

                const pk = col.pk ? ' PRIMARY KEY' : '';
                const notNull = col.notnull && !col.pk ? ' NOT NULL' : '';

                return `  ${col.name} ${pgType}${pk}${notNull}`;
            });

            const createStmt = `CREATE TABLE IF NOT EXISTS ${pgTableName} (\n${colDefs.join(',\n')}\n);`;
            result.createStatements.push({
                tableName: pgTableName,
                sql: createStmt
            });
        }

        // JSON olarak kaydet
        fs.writeFileSync(
            path.join(__dirname, 'entegra-db-schema.json'),
            JSON.stringify(result, null, 2),
            'utf8'
        );

        console.log('Analiz tamamlandı. Sonuç: scripts/entegra-db-schema.json');

        // Özet bilgi
        console.log('\n--- ÖZET ---');
        console.log('Toplam tablo sayısı:', result.allTables.length);
        console.log('Tüm tablolar:', result.allTables.join(', '));
        console.log('\nHedef tablolar:');
        for (const [name, info] of Object.entries(result.targetTables)) {
            if (info.exists) {
                console.log(`  ${name}: ${info.columns.length} kolon, ${info.rowCount} kayıt`);
            } else {
                console.log(`  ${name}: BULUNAMADI`);
            }
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        if (db) db.close();
    }
}

exploreDatabase();
