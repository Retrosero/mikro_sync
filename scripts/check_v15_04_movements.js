require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkV04Movements() {
    const productCode = '6056902';
    try {
        console.log(`Mikro (V15_04) Hareketler: ${productCode}`);
        const res = await mssqlService.query(`
            SELECT sth_tip, sth_miktar, sth_create_date
            FROM MikroDB_V15_04.dbo.STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}'
        `);
        console.log('V15_04 Hareketleri:', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkV04Movements();
