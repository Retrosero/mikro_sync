require('dotenv').config();
const sqliteService = require('../services/sqlite.service');
const fs = require('fs');

async function listSqliteTables() {
    try {
        // SQLite bağlantısını aç
        sqliteService.connect(true); // readonly modunda aç

        // Tüm tabloları listele
        const tables = sqliteService.query(`
            SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
        `);

        // Dosyaya yaz
        const output = [];
        output.push('SQLite Tablolari:');
        tables.forEach(t => output.push(`  - ${t.name}`));

        // product ile ilgili tabloları bul
        output.push('\n--- Product ile ilgili tablolar ---');
        const productTables = tables.filter(t => t.name.toLowerCase().includes('product') || t.name.toLowerCase().includes('quantity'));
        productTables.forEach(t => output.push(`  - ${t.name}`));

        fs.writeFileSync('sqlite_tables.txt', output.join('\n'), 'utf8');
        console.log('Sonuclar sqlite_tables.txt dosyasina yazildi');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        sqliteService.disconnect();
        process.exit(0);
    }
}

listSqliteTables();
