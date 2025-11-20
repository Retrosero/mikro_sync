require('dotenv').config();
const mssqlService = require('../services/mssql.service');
const fs = require('fs').promises;
const path = require('path');

async function manualMSSQLSetup() {
    try {
        console.log('MS SQL manuel kurulum başlıyor...');
        console.log('Veritabanı:', process.env.MSSQL_DATABASE);

        const sqlFile = await fs.readFile(
            path.join(__dirname, 'sql', 'mssql-setup.sql'),
            'utf8'
        );

        console.log('SQL dosyası okundu, çalıştırılıyor...');

        // Split by GO statements
        const statements = sqlFile
            .split(/\r?\nGO\r?\n/i)
            .filter(s => s.trim());

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                try {
                    console.log(`Executing statement ${i + 1}/${statements.length}...`);
                    await mssqlService.query(statement);
                } catch (error) {
                    console.error(`Error in statement ${i + 1}:`, error.message);
                    // Continue with other statements
                }
            }
        }

        console.log('✓ MS SQL tabloları başarıyla oluşturuldu');

        // Verify tables
        const tables = await mssqlService.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('SYNC_QUEUE', 'INT_KodMap_Cari', 'INT_KodMap_Stok', 'SYNC_LOGS')
      ORDER BY TABLE_NAME
    `);

        console.log('\nOluşturulan tablolar:');
        tables.forEach(t => console.log('  -', t.TABLE_NAME));

        await mssqlService.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Hata:', error.message);
        console.error('Detay:', error);
        await mssqlService.disconnect();
        process.exit(1);
    }
}

manualMSSQLSetup();
