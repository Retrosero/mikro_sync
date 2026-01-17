require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkDepots() {
    const productCode = '6056902';
    try {
        console.log(`Mikro (V15_02) Depo Bazlı Stok: ${productCode}`);

        const res = await mssqlService.query(`
            SELECT 
                depo_no,
                SUM(miktar) as stok
            FROM (
                SELECT sth_giris_depo_no as depo_no, sth_miktar as miktar FROM STOK_HAREKETLERI WITH (NOLOCK) WHERE sth_stok_kod = '${productCode}' AND sth_tip = 0
                UNION ALL
                SELECT sth_cikis_depo_no as depo_no, -sth_miktar as miktar FROM STOK_HAREKETLERI WITH (NOLOCK) WHERE sth_stok_kod = '${productCode}' AND sth_tip = 1
            ) t
            GROUP BY depo_no
        `);
        console.log('Depo Bazlı Net Sonuçlar:', res);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDepots();
