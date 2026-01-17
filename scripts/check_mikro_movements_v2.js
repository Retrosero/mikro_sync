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
                sth_miktar,
                sth_giris_depo_no,
                sth_cikis_depo_no,
                sth_stok_kod
            FROM STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}'
            ORDER BY sth_create_date DESC
        `);
        console.log('Hareket Listesi:', JSON.stringify(res, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkMovements();
