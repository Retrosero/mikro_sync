require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkErpRecno() {
    try {
        console.log('cari_hesap_hareketleri tablosunda erp_recno kontrol ediliyor...\n');

        // Son eklenen kayıtları kontrol et
        const records = await pgService.query(`
            SELECT id, erp_recno, cari_hesap_id, islem_tarihi, belge_no, tutar, hareket_tipi
            FROM cari_hesap_hareketleri
            ORDER BY guncelleme_tarihi DESC
            LIMIT 5
        `);

        console.log('Son 5 kayıt:');
        console.table(records);

        // erp_recno null olan kayıt sayısı
        const nullCount = await pgService.query(`
            SELECT COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE erp_recno IS NULL
        `);

        console.log(`\nerp_recno NULL olan kayıt sayısı: ${nullCount[0].count}`);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkErpRecno();
