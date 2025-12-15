require('dotenv').config();
const pgService = require('./services/postgresql.service');

async function checkErpFields() {
    try {
        console.log('ERP alanları kontrol ediliyor...\n');

        // cha_tpoz, cha_cari_cins, cha_grupno değerlerini kontrol et
        const records = await pgService.query(`
            SELECT cha_tpoz, cha_cari_cins, cha_grupno, COUNT(*) as count
            FROM cari_hesap_hareketleri
            GROUP BY cha_tpoz, cha_cari_cins, cha_grupno
            ORDER BY count DESC
            LIMIT 10
        `);

        console.log('ERP Alanları Dağılımı:');
        console.table(records);

        // Banka işlemleri (cha_tpoz=1, cha_cari_cins=2, cha_grupno=1)
        const bankaCount = await pgService.query(`
            SELECT COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE cha_tpoz = 1 AND cha_cari_cins = 2 AND cha_grupno = 1
        `);
        console.log(`\nBanka işlemleri (cha_tpoz=1, cha_cari_cins=2, cha_grupno=1): ${bankaCount[0].count}`);

        // Kasa işlemleri (cha_tpoz=1, cha_cari_cins=4, cha_grupno=0)
        const kasaCount = await pgService.query(`
            SELECT COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE cha_tpoz = 1 AND cha_cari_cins = 4 AND cha_grupno = 0
        `);
        console.log(`Kasa işlemleri (cha_tpoz=1, cha_cari_cins=4, cha_grupno=0): ${kasaCount[0].count}`);

        // Açık hesap (cha_tpoz=0, cha_cari_cins=0, cha_grupno=0)
        const acikHesapCount = await pgService.query(`
            SELECT COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE cha_tpoz = 0 AND cha_cari_cins = 0 AND cha_grupno = 0
        `);
        console.log(`Açık hesap (cha_tpoz=0, cha_cari_cins=0, cha_grupno=0): ${acikHesapCount[0].count}`);

        // Örnek kayıtlar
        const samples = await pgService.query(`
            SELECT hareket_tipi, hareket_turu, cha_tpoz, cha_cari_cins, cha_grupno
            FROM cari_hesap_hareketleri
            WHERE cha_tpoz != 0 OR cha_cari_cins != 0 OR cha_grupno != 0
            LIMIT 5
        `);

        console.log('\nÖrnek Kayıtlar (0 olmayan):');
        console.table(samples);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkErpFields();
