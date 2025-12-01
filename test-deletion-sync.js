require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');
const syncDeletedRecords = require('./scripts/sync-deleted-from-erp');

async function testDeletionSync() {
    try {
        console.log('TEST: Deletion Sync Verification');

        // 1. Web tarafında test için geçici bir stok oluştur
        const testStokKodu = 'TEST_DELETE_SYNC_001';
        console.log(`1. Web tarafında test stoğu oluşturuluyor: ${testStokKodu}`);

        const stokId = await pgService.queryOne(`
            INSERT INTO stoklar (stok_kodu, stok_adi, aktif)
            VALUES ($1, 'Test Delete Sync', true)
            RETURNING id
        `, [testStokKodu]);

        console.log(`   Web Stok ID: ${stokId.id}`);

        // 2. Mapping ekle
        await pgService.query(`
            INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod)
            VALUES ($1, $2)
        `, [stokId.id, testStokKodu]);
        console.log('   Mapping eklendi.');

        // 3. MSSQL Log tablosuna manuel kayıt ekle (Trigger tetiklenmiş gibi)
        console.log('2. MSSQL Log tablosuna manuel kayıt ekleniyor...');
        await mssqlService.query(`
            INSERT INTO MIKRO_SYNC_DELETED_LOG (table_name, record_id)
            VALUES ('STOKLAR', @recordId)
        `, { recordId: testStokKodu });
        console.log('   Log kaydı eklendi.');

        // 4. Sync scriptini çalıştır
        console.log('3. Sync scripti çalıştırılıyor...');
        await syncDeletedRecords();

        // 5. Doğrulama
        console.log('4. Doğrulama yapılıyor...');
        const webStok = await pgService.queryOne(
            'SELECT id FROM stoklar WHERE id = $1',
            [stokId.id]
        );

        if (!webStok) {
            console.log('✓ BAŞARILI: Stok Web tarafından silindi.');
        } else {
            console.error('✗ BAŞARISIZ: Stok hala Web veritabanında duruyor!');
        }

        const logRecord = await mssqlService.query(`
            SELECT processed FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'STOKLAR' AND record_id = @recordId
        `, { recordId: testStokKodu });

        if (logRecord[0].processed) {
            console.log('✓ BAŞARILI: MSSQL Log kaydı işlendi olarak işaretlendi.');
        } else {
            console.error('✗ BAŞARISIZ: MSSQL Log kaydı işlenmedi!');
        }

    } catch (error) {
        console.error('Test hatası:', error);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

testDeletionSync();
