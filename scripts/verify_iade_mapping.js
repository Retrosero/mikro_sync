const pgService = require('../services/postgresql.service');

(async () => {
    try {
        console.log('--- Checking Cari Hesap Hareketleri for 202 ---');
        const res = await pgService.query(`
            SELECT ch.cari_kodu, chh.belge_no, chh.belge_tipi, chh.hareket_tipi, chh.tutar, chh.fatura_seri_no, chh.fatura_sira_no
            FROM cari_hesap_hareketleri chh
            JOIN cari_hesaplar ch ON chh.cari_hesap_id = ch.id
            WHERE chh.fatura_sira_no = '202'
        `);
        console.log(JSON.stringify(res, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
})();
