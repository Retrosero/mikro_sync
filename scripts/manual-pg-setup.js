require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs').promises;
const path = require('path');

async function manualSetup() {
    try {
        console.log('PostgreSQL manuel kurulum başlıyor...');
        console.log('Veritabanı:', process.env.PG_DATABASE);

        const sqlFile = await fs.readFile(
            path.join(__dirname, 'sql', 'postgresql-setup.sql'),
            'utf8'
        );

        console.log('SQL dosyası okundu, çalıştırılıyor...');

        // Execute the entire file as one query
        await pgService.query(sqlFile);

        console.log('✓ PostgreSQL tabloları başarıyla oluşturuldu');

        // Verify tables
        const tables = await pgService.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sync_queue', 'int_kodmap_cari', 'int_kodmap_stok', 'sync_logs')
      ORDER BY table_name
    `);

        console.log('\nOluşturulan tablolar:');
        tables.forEach(t => console.log('  -', t.table_name));

        await pgService.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Hata:', error.message);
        console.error('Detay:', error);
        await pgService.disconnect();
        process.exit(1);
    }
}

manualSetup();
