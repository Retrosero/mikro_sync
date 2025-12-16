require('dotenv').config();
const mssqlService = require('./services/mssql.service');

(async () => {
    try {
        console.log('Spesifik RecNo kontrolü...\n');

        // Spesifik ODEME_EMIRLERI kayıtlarını getir
        // Not: RecNo'lar önceki loglardan alındı
        const odemeEmirleri = await mssqlService.query(`
      SELECT
        sck_RECno,
        sck_tip,
        sck_refno,
        sck_tutar,
        sck_create_date,
        sck_lastup_date
      FROM ODEME_EMIRLERI
      WHERE sck_RECno IN (21949, 21950, 21951)
    `);

        console.log('=== ODEME_EMIRLERI (SPESIFIK) ===');
        odemeEmirleri.forEach(row => {
            console.log(`\nRecNo: ${row.sck_RECno}`);
            console.log(`  Tip: ${row.sck_tip}`);
            console.log(`  Refno: ${row.sck_refno}`);
            console.log(`  Create Date: ${row.sck_create_date}`);
            console.log(`  Lastup Date: ${row.sck_lastup_date}`);
        });

        // CARI_HESAP_HAREKETLERI için son eklenenleri create date olmadan getirip kontrol edelim
        const cariHareketler = await mssqlService.query(`
      SELECT TOP 5
        cha_RECno,
        cha_create_date,
        cha_lastup_date
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrak_tip = 1
      ORDER BY cha_RECno DESC
    `);

        console.log('\n=== CARI_HESAP_HAREKETLERI (SON 5) ===');
        cariHareketler.forEach(row => {
            console.log(`\nRecNo: ${row.cha_RECno}`);
            console.log(`  Create Date: ${row.cha_create_date}`);
        });

        await mssqlService.disconnect();
    } catch (err) {
        console.error('Hata:', err);
        process.exit(1);
    }
})();
