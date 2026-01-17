require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkMovements() {
    const productCode = '6056902';
    try {
        console.log(`Mikro (V15_02) Hareket Detayları: ${productCode}`);

        const res = await mssqlService.query(`
            SELECT 
                sth_create_date,
                sth_tip,
                sth_cins,
                sth_evraktip,
                sth_miktar,
                sth_depo_no,
                sth_stok_kod
            FROM STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}'
            ORDER BY sth_create_date DESC
        `);
        console.log('Hareket Listesi:', JSON.stringify(res, null, 2));

        const stockSummary = await mssqlService.query(`
            SELECT 
                sth_tip,
                sth_cins,
                COUNT(*) as h_adet,
                SUM(sth_miktar) as t_miktar
            FROM STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}'
            GROUP BY sth_tip, sth_cins
        `);
        console.log('Özet:', stockSummary);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkMovements();
