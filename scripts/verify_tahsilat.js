const pgService = require('../services/postgresql.service');

(async () => {
    try {
        console.log('--- Checking Cari Hesap Hareketleri for Tahsilat ---');
        // Check a few records that are mapped as 'tahsilat'
        const res = await pgService.query(`
            SELECT belge_no, belge_tipi, hareket_tipi, tutar
            FROM cari_hesap_hareketleri
            WHERE belge_tipi = 'tahsilat'
            LIMIT 10
        `);
        console.log(JSON.stringify(res, null, 2));

        // Count total tahsilat
        const countRes = await pgService.query(`
            SELECT COUNT(*) as count
            FROM cari_hesap_hareketleri
            WHERE belge_tipi = 'tahsilat'
        `);
        console.log('Total Tahsilat:', countRes[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
})();
