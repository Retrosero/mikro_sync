require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function findDeleteTable() {
    try {
        console.log('MSSQL\'de silme tablosunu arıyorum...\n');

        // Tüm tabloları listele
        const allTables = await mssqlService.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            AND TABLE_NAME LIKE '%SYNC%' OR TABLE_NAME LIKE '%DELETE%' OR TABLE_NAME LIKE '%MIKRO%'
            ORDER BY TABLE_NAME
        `);

        console.log('SYNC, DELETE veya MIKRO içeren tablolar:');
        if (allTables.length > 0) {
            allTables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));
        } else {
            console.log('  Hiç tablo bulunamadı!');
        }

        // Özel olarak bizim tabloyu ara
        console.log('\n"MIKRO_SYNC_DELETED_LOG" tablosunu arıyorum...');
        const specificTable = await mssqlService.query(`
            SELECT TABLE_NAME, TABLE_SCHEMA
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'MIKRO_SYNC_DELETED_LOG'
        `);

        if (specificTable.length > 0) {
            console.log(`✅ Tablo bulundu: ${specificTable[0].TABLE_SCHEMA}.${specificTable[0].TABLE_NAME}`);

            // Kayıt sayısı
            const count = await mssqlService.query(`SELECT COUNT(*) as total FROM MIKRO_SYNC_DELETED_LOG`);
            console.log(`   Kayıt sayısı: ${count[0].total}`);
        } else {
            console.log('❌ Tablo bulunamadı!');
            console.log('\nTabloyu oluşturmak için şu komutu çalıştırın:');
            console.log('  node apply-mssql-sql.js');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

findDeleteTable();
