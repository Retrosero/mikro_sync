require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkMssqlSetup() {
    try {
        console.log('='.repeat(70));
        console.log('MSSQL KURULUM KONTROLÜ');
        console.log('='.repeat(70));

        // 1. Tablo var mı kontrol et
        console.log('\n1. MIKRO_SYNC_DELETED_LOG tablosu kontrol ediliyor...');
        const tableCheck = await mssqlService.query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'MIKRO_SYNC_DELETED_LOG'
        `);

        if (tableCheck.length > 0) {
            console.log('   ✅ Tablo mevcut');

            // Kayıt sayısı
            const count = await mssqlService.query(`
                SELECT COUNT(*) as total FROM MIKRO_SYNC_DELETED_LOG
            `);
            console.log(`   📊 Toplam kayıt: ${count[0].total}`);

            // Son kayıtlar
            const recent = await mssqlService.query(`
                SELECT TOP 5 * FROM MIKRO_SYNC_DELETED_LOG 
                ORDER BY deleted_at DESC
            `);
            console.log(`   📝 Son ${recent.length} kayıt:`);
            recent.forEach(r => {
                console.log(`      - ${r.table_name}: ${r.record_id} (Processed: ${r.processed})`);
            });
        } else {
            console.log('   ❌ Tablo bulunamadı! Oluşturulması gerekiyor.');
        }

        // 2. Trigger'ları kontrol et
        console.log('\n2. Trigger\'lar kontrol ediliyor...');
        const triggers = await mssqlService.query(`
            SELECT 
                t.name as trigger_name,
                OBJECT_NAME(t.parent_id) as table_name
            FROM sys.triggers t
            WHERE t.name LIKE 'TRG_MIKRO_SYNC%'
        `);

        if (triggers.length > 0) {
            console.log(`   ✅ ${triggers.length} trigger bulundu:`);
            triggers.forEach(tr => {
                console.log(`      - ${tr.trigger_name} (${tr.table_name})`);
            });
        } else {
            console.log('   ❌ Hiç trigger bulunamadı! Oluşturulması gerekiyor.');
        }

        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkMssqlSetup();
