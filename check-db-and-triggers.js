require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkDatabaseAndTriggers() {
    try {
        console.log('='.repeat(70));
        console.log('VERİTABANI VE TRIGGER KONTROLÜ');
        console.log('='.repeat(70));

        // 1. Bağlı olduğumuz veritabanını göster
        console.log('\n1. Bağlı olduğumuz veritabanı:');
        const currentDb = await mssqlService.query('SELECT DB_NAME() as current_database');
        console.log(`   ${currentDb[0].current_database}`);

        // 2. Tüm veritabanlarında MIKRO_SYNC_DELETED_LOG tablosunu ara
        console.log('\n2. MIKRO_SYNC_DELETED_LOG tablosunu tüm veritabanlarında arıyorum...');
        const databases = await mssqlService.query(`
            SELECT name FROM sys.databases 
            WHERE name NOT IN ('master', 'tempdb', 'model', 'msdb')
        `);

        for (const db of databases) {
            try {
                const tableCheck = await mssqlService.query(`
                    SELECT COUNT(*) as cnt 
                    FROM [${db.name}].INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_NAME = 'MIKRO_SYNC_DELETED_LOG'
                `);

                if (tableCheck[0].cnt > 0) {
                    console.log(`   ✅ Bulundu: ${db.name}.dbo.MIKRO_SYNC_DELETED_LOG`);

                    // Kayıt sayısı
                    const count = await mssqlService.query(`SELECT COUNT(*) as total FROM [${db.name}].dbo.MIKRO_SYNC_DELETED_LOG`);
                    console.log(`      Kayıt sayısı: ${count[0].total}`);
                }
            } catch (e) {
                // Erişim hatası, atla
            }
        }

        // 3. Trigger'ları kontrol et
        console.log('\n3. Trigger\'ları kontrol ediyorum...');
        const triggers = await mssqlService.query(`
            SELECT 
                DB_NAME() as database_name,
                t.name as trigger_name,
                OBJECT_NAME(t.parent_id) as table_name,
                OBJECT_SCHEMA_NAME(t.parent_id) as schema_name
            FROM sys.triggers t
            WHERE t.name LIKE 'TRG_MIKRO_SYNC%'
        `);

        if (triggers.length > 0) {
            console.log(`   ✅ ${triggers.length} trigger bulundu:`);
            triggers.forEach(tr => {
                console.log(`      - ${tr.database_name}.${tr.schema_name}.${tr.table_name} -> ${tr.trigger_name}`);
            });
        } else {
            console.log('   ❌ Hiç trigger bulunamadı!');
        }

        // 4. .env dosyasındaki veritabanı ayarlarını göster
        console.log('\n4. .env dosyasındaki MSSQL ayarları:');
        console.log(`   Server: ${process.env.MSSQL_SERVER}`);
        console.log(`   Database: ${process.env.MSSQL_DATABASE}`);
        console.log(`   User: ${process.env.MSSQL_USER}`);

        console.log('\n' + '='.repeat(70));
        console.log('ÖNERİ:');
        console.log('Eğer tablo farklı bir veritabanındaysa, .env dosyasındaki');
        console.log('MSSQL_DATABASE değerini doğru veritabanı adıyla güncelleyin.');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDatabaseAndTriggers();
