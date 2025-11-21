const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupSyncState() {
    const client = new Client({
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || '5432'),
        database: process.env.PG_DATABASE,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    try {
        console.log('PostgreSQL bağlantısı kuruluyor...');
        await client.connect();
        console.log('✓ Bağlantı başarılı\n');

        const sqlFile = path.join(__dirname, 'create_sync_state_table.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('sync_state tablosu oluşturuluyor...');
        await client.query(sql);
        console.log('✓ sync_state tablosu başarıyla oluşturuldu!\n');

    } catch (error) {
        console.error('Hata:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupSyncState();
