require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function verifyDeletionSync() {
    try {
        console.log('='.repeat(70));
        console.log('GERÇEK SİLME SENKRONIZASYONU DOĞRULAMA');
        console.log('='.repeat(70));

        // 1. MSSQL log tablosunu kontrol et
        console.log('\n📋 ADIM 1: MSSQL silme loglarını kontrol ediyorum...');
        const deletedLogs = await mssqlService.query(`
            SELECT * FROM MIKRO_SYNC_DELETED_LOG 
            WHERE processed = 0
            ORDER BY deleted_at DESC
        `);

        if (deletedLogs.length === 0) {
            console.log('   ⚠️  Henüz işlenmemiş silme kaydı yok.');
            console.log('   💡 Lütfen Mikro\'da bir stok silin ve bu scripti tekrar çalıştırın.');
            return;
        }

        console.log(`   ✅ ${deletedLogs.length} adet işlenmemiş silme kaydı bulundu:`);
        deletedLogs.forEach((log, i) => {
            console.log(`      ${i + 1}. ${log.table_name}: ${log.record_id} (${log.deleted_at})`);
        });

        // 2. Web'de bu kayıtların durumunu kontrol et
        console.log('\n📋 ADIM 2: Web veritabanında bu kayıtları kontrol ediyorum...');
        for (const log of deletedLogs) {
            if (log.table_name === 'STOKLAR') {
                const mapping = await pgService.queryOne(
                    'SELECT web_stok_id FROM int_kodmap_stok WHERE erp_stok_kod = $1',
                    [log.record_id]
                );

                if (mapping) {
                    const webStok = await pgService.queryOne(
                        'SELECT stok_kodu, stok_adi FROM stoklar WHERE id = $1',
                        [mapping.web_stok_id]
                    );

                    if (webStok) {
                        console.log(`   ⚠️  Stok hala Web'de mevcut: ${webStok.stok_kodu} - ${webStok.stok_adi}`);
                    } else {
                        console.log(`   ✅ Stok Web'den silinmiş: ${log.record_id}`);
                    }
                } else {
                    console.log(`   ℹ️  Mapping bulunamadı: ${log.record_id} (Belki daha önce silinmiş)`);
                }
            }
        }

        // 3. Senkronizasyon önerisi
        console.log('\n📋 ADIM 3: Senkronizasyon önerisi');
        console.log('   💡 Silinen kayıtları Web\'den de silmek için şu komutu çalıştırın:');
        console.log('      npm run sync-bidirectional');
        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

verifyDeletionSync();
