const pgService = require('../services/postgresql.service');

(async () => {
    try {
        console.log('--- Cari Hesap Hareketleri ---');
        const cariRes = await pgService.query(`
            SELECT belge_no, fatura_seri_no, fatura_sira_no 
            FROM cari_hesap_hareketleri 
            WHERE fatura_seri_no IS NOT NULL OR fatura_sira_no IS NOT NULL 
            LIMIT 5
        `);
        console.table(cariRes);

        console.log('\n--- Stok Hareketleri ---');
        const stokRes = await pgService.query(`
            SELECT belge_no, fatura_seri_no, fatura_sira_no 
            FROM stok_hareketleri 
            WHERE fatura_seri_no IS NOT NULL OR fatura_sira_no IS NOT NULL 
            LIMIT 5
        `);
        console.table(stokRes);

    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
})();
