require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function testDeletion() {
    try {
        console.log('='.repeat(70));
        console.log('SİLME SENKRONIZASYONU TESTİ');
        console.log('='.repeat(70));

        // 1. Web'de test stoğu oluştur
        const testStokKodu = `TEST_DEL_${Date.now()}`;
        console.log(`\n1. Web'de test stoğu oluşturuluyor: ${testStokKodu}`);

        const stokResult = await pgService.queryOne(`
            INSERT INTO stoklar (stok_kodu, stok_adi, aktif)
            VALUES ($1, 'Test Silme Stoğu', true)
            RETURNING id
        `, [testStokKodu]);

        const webStokId = stokResult.id;
        console.log(`   ✓ Web Stok ID: ${webStokId}`);

        // 2. Mapping ekle
        await pgService.query(`
            INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod)
            VALUES ($1, $2)
        `, [webStokId, testStokKodu]);
        console.log('   ✓ Mapping eklendi');

        // 3. MSSQL Log tablosuna "silinmiş" kaydı ekle (Gerçek silme simülasyonu)
        console.log(`\n2. ERP'de silme simüle ediliyor...`);
        await mssqlService.query(`
            INSERT INTO MIKRO_SYNC_DELETED_LOG (table_name, record_id, processed)
            VALUES ('STOKLAR', @recordId, 0)
        `, { recordId: testStokKodu });
        console.log('   ✓ Silme log kaydı eklendi');

        // 4. Sync scriptini çalıştır
        console.log(`\n3. Silme senkronizasyonu çalıştırılıyor...`);
        const syncDeletedRecords = require('./scripts/sync-deleted-from-erp');
        await syncDeletedRecords();

        // 5. Doğrulama
        console.log(`\n4. Doğrulama yapılıyor...`);

        const webStok = await pgService.queryOne(
            'SELECT id FROM stoklar WHERE id = $1',
            [webStokId]
        );

        const mapping = await pgService.queryOne(
            'SELECT * FROM int_kodmap_stok WHERE erp_stok_kod = $1',
            [testStokKodu]
        );

        const logRecord = await mssqlService.query(`
            SELECT processed FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'STOKLAR' AND record_id = @recordId
        `, { recordId: testStokKodu });

        console.log('\n' + '='.repeat(70));
        console.log('TEST SONUÇLARI:');
        console.log('='.repeat(70));

        if (!webStok) {
            console.log('✅ BAŞARILI: Stok Web tarafından silindi');
        } else {
            console.log('❌ BAŞARISIZ: Stok hala Web veritabanında duruyor!');
        }

        if (!mapping) {
            console.log('✅ BAŞARILI: Mapping silindi');
        } else {
            console.log('❌ BAŞARISIZ: Mapping hala duruyor!');
        }

        if (logRecord[0] && logRecord[0].processed) {
            console.log('✅ BAŞARILI: MSSQL Log kaydı işlendi olarak işaretlendi');
        } else {
            console.log('❌ BAŞARISIZ: MSSQL Log kaydı işlenmedi!');
        }

        console.log('='.repeat(70));

    } catch (error) {
        console.error('\n❌ Test hatası:', error.message);
        console.error(error.stack);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

testDeletion();
