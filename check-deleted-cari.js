require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkDeletedCari() {
    try {
        console.log('='.repeat(70));
        console.log('SİLİNEN CARİ KAYITLARINI KONTROL');
        console.log('='.repeat(70));

        // Log tablosundaki tüm cari silme kayıtlarını göster
        const cariDeletes = await mssqlService.query(`
            SELECT * FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'CARI_HESAPLAR'
            ORDER BY deleted_at DESC
        `);

        if (cariDeletes.length === 0) {
            console.log('\n❌ Henüz silinmiş cari kaydı yok.');
            console.log('\n📝 TEST İÇİN:');
            console.log('   1. Mikro\'da bir cari silin');
            console.log('   2. Bu scripti tekrar çalıştırın: node check-deleted-cari.js');
            console.log('   3. Kayıt görünüyorsa trigger çalışıyor demektir');
        } else {
            console.log(`\n✅ ${cariDeletes.length} adet silinmiş cari kaydı bulundu:\n`);
            cariDeletes.forEach((log, i) => {
                console.log(`${i + 1}. Cari Kodu: ${log.record_id}`);
                console.log(`   Silinme Tarihi: ${log.deleted_at}`);
                console.log(`   İşlendi mi: ${log.processed ? 'Evet' : 'Hayır'}`);
                console.log('');
            });
        }

        console.log('='.repeat(70));

    } catch (error) {
        console.error('❌ Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDeletedCari();
