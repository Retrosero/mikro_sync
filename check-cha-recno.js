require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkChaRecno() {
    try {
        console.log('cari_hesap_hareketleri tablosunda cha_recno kontrol ediliyor...\n');

        // Son eklenen kayıtları kontrol et
        const records = await pgService.query(`
            SELECT id, erp_recno, cha_recno, cari_hesap_id, belge_no, tutar, hareket_tipi
            FROM cari_hesap_hareketleri
            ORDER BY guncelleme_tarihi DESC
            LIMIT 5
        `);

        console.log('Son 5 kayıt:');
        console.table(records);

        // cha_recno null olan kayıt sayısı
        const nullCount = await pgService.query(`
            SELECT COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE cha_recno IS NULL
        `);

        console.log(`\ncha_recno NULL olan kayıt sayısı: ${nullCount[0].count}`);

        // erp_recno ve cha_recno eşit mi kontrol
        const mismatch = await pgService.query(`
            SELECT COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE erp_recno IS NOT NULL 
            AND cha_recno IS NOT NULL 
            AND erp_recno != cha_recno
        `);

        console.log(`erp_recno != cha_recno olan kayıt sayısı: ${mismatch[0].count}`);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkChaRecno();
