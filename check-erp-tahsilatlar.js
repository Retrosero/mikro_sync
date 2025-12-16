require('dotenv').config();
const mssqlService = require('./services/mssql.service');

(async () => {
    try {
        console.log('Son eklenen tahsilat kayıtları kontrol ediliyor...\n');

        // Son 10 CARI_HESAP_HAREKETLERI kaydını getir
        const cariHareketler = await mssqlService.query(`
      SELECT TOP 10
        cha_RECno,
        cha_evrakno_sira,
        cha_tarihi,
        cha_kod,
        cha_meblag,
        cha_cinsi,
        cha_aciklama,
        cha_create_date,
        cha_lastup_date
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrak_tip = 1
      ORDER BY cha_RECno DESC
    `);

        console.log('=== SON CARI HESAP HAREKETLERİ ===');
        cariHareketler.forEach(row => {
            console.log(`\nRecNo: ${row.cha_RECno}`);
            console.log(`  Evrak Sıra: ${row.cha_evrakno_sira}`);
            console.log(`  Tarih: ${row.cha_tarihi}`);
            console.log(`  Kod: ${row.cha_kod}`);
            console.log(`  Tutar: ${row.cha_meblag}`);
            console.log(`  Cinsi: ${row.cha_cinsi} (0=Nakit, 1=Çek, 2=Senet, 17=Havale, 19=Kredi Kartı)`);
            console.log(`  Açıklama: ${row.cha_aciklama}`);
            console.log(`  Create Date: ${row.cha_create_date}`);
            console.log(`  Lastup Date: ${row.cha_lastup_date}`);
        });

        console.log('\n\n=== SON ÖDEME EMİRLERİ ===');
        const odemeEmirleri = await mssqlService.query(`
      SELECT TOP 10
        sck_RECno,
        sck_tip,
        sck_refno,
        sck_tutar,
        sck_sahip_cari_kodu,
        sck_borclu,
        sck_create_date,
        sck_lastup_date
      FROM ODEME_EMIRLERI
      WHERE sck_refno LIKE 'M%-%'
      ORDER BY sck_RECno DESC
    `);

        odemeEmirleri.forEach(row => {
            console.log(`\nRecNo: ${row.sck_RECno}`);
            console.log(`  Tip: ${row.sck_tip} (0=Çek, 1=Senet, 4=Havale, 6=Kredi Kartı)`);
            console.log(`  Refno: ${row.sck_refno}`);
            console.log(`  Tutar: ${row.sck_tutar}`);
            console.log(`  Cari Kod: ${row.sck_sahip_cari_kodu}`);
            console.log(`  Borçlu: ${row.sck_borclu}`);
            console.log(`  Create Date: ${row.sck_create_date}`);
            console.log(`  Lastup Date: ${row.sck_lastup_date}`);
        });

        await mssqlService.disconnect();
    } catch (err) {
        console.error('Hata:', err);
        process.exit(1);
    }
})();
