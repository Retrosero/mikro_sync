const pgService = require('../services/postgresql.service');

(async () => {
    try {
        console.log('--- Checking Stok Hareketleri for 202 ---');
        const res = await pgService.query(`
            SELECT sh.belge_no, sh.belge_tipi, sh.hareket_tipi, sh.miktar, sh.fatura_seri_no, sh.fatura_sira_no
            FROM stok_hareketleri sh
            WHERE sh.fatura_sira_no = '202' AND (sh.fatura_seri_no = '' OR sh.fatura_seri_no IS NULL)
        `);
        console.log(JSON.stringify(res, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
})();
