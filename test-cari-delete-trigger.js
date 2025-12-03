require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function testCariDeleteTrigger() {
    try {
        console.log('='.repeat(70));
        console.log('CARİ SİLME TRIGGER TESTİ');
        console.log('='.repeat(70));

        // 1. Trigger'ı kontrol et
        console.log('\n1. Trigger kontrol ediliyor...');
        const trigger = await mssqlService.query(`
            SELECT 
                t.name as trigger_name,
                OBJECT_NAME(t.parent_id) as table_name,
                m.definition
            FROM sys.triggers t
            INNER JOIN sys.sql_modules m ON t.object_id = m.object_id
            WHERE t.name = 'TRG_MIKRO_SYNC_CARI_DELETE'
        `);

        if (trigger.length > 0) {
            console.log(`   ✅ Trigger bulundu: ${trigger[0].trigger_name}`);
            console.log(`   Tablo: ${trigger[0].table_name}`);
            console.log(`\n   Trigger kodu:`);
            console.log(trigger[0].definition);
        } else {
            console.log('   ❌ Trigger bulunamadı!');
        }

        // 2. Test cari oluştur ve sil
        console.log('\n2. Test cari oluşturuluyor...');
        const testKod = 'TESTCARI01';

        try {
            // Önce varsa sil
            await mssqlService.query(`DELETE FROM CARI_HESAPLAR WHERE cari_kod = @kod`, { kod: testKod });
            await mssqlService.query(`DELETE FROM MIKRO_SYNC_DELETED_LOG WHERE record_id = @kod`, { kod: testKod });

            // Yeni oluştur
            await mssqlService.query(`
                INSERT INTO CARI_HESAPLAR (cari_kod, cari_unvan1)
                VALUES (@kod, 'Test Cari')
            `, { kod: testKod });
            console.log('   ✅ Test cari oluşturuldu');

            // Sil
            console.log('\n3. Test cari siliniyor...');
            await mssqlService.query(`DELETE FROM CARI_HESAPLAR WHERE cari_kod = @kod`, { kod: testKod });
            console.log('   ✅ Test cari silindi');

            // Log kontrol et
            console.log('\n4. Log tablosu kontrol ediliyor...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const log = await mssqlService.query(`
                SELECT * FROM MIKRO_SYNC_DELETED_LOG 
                WHERE record_id = @kod
            `, { kod: testKod });

            if (log.length > 0) {
                console.log('   ✅ BAŞARILI: Trigger çalıştı!');
                console.log(`      Tablo: ${log[0].table_name}`);
                console.log(`      Kayıt: ${log[0].record_id}`);

                // Temizlik
                await mssqlService.query(`DELETE FROM MIKRO_SYNC_DELETED_LOG WHERE record_id = @kod`, { kod: testKod });
            } else {
                console.log('   ❌ BAŞARISIZ: Trigger çalışmadı!');
                console.log('   Trigger muhtemelen doğru kurulmamış.');
            }

        } catch (error) {
            console.log(`   ⚠️  Test sırasında hata: ${error.message}`);
            console.log('   Bu normal olabilir (zorunlu alanlar eksik)');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

testCariDeleteTrigger();
