require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function simpleCheck() {
    try {
        // Hangi veritabanına bağlıyız?
        const db = await mssqlService.query('SELECT DB_NAME() as db');
        console.log('Bagli veritabani:', db[0].db);

        // Tablo var mı?
        const table = await mssqlService.query(`
            SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'MIKRO_SYNC_DELETED_LOG'
        `);
        console.log('Tablo var mi:', table[0].cnt > 0 ? 'EVET' : 'HAYIR');

        if (table[0].cnt > 0) {
            const count = await mssqlService.query('SELECT COUNT(*) as total FROM MIKRO_SYNC_DELETED_LOG');
            console.log('Kayit sayisi:', count[0].total);
        }

        // Trigger'lar var mı?
        const triggers = await mssqlService.query(`
            SELECT name FROM sys.triggers WHERE name LIKE 'TRG_MIKRO_SYNC%'
        `);
        console.log('Trigger sayisi:', triggers.length);
        triggers.forEach(t => console.log('  -', t.name));

        // .env ayarları
        console.log('\n.env MSSQL_DATABASE:', process.env.MSSQL_DATABASE);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

simpleCheck();
