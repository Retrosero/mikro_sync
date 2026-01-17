require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function searchProduct() {
    try {
        const res = await mssqlService.query(`
            SELECT sto_kod, sto_isim, sto_RECno
            FROM STOKLAR WITH (NOLOCK)
            WHERE sto_kod LIKE '%6056902%'
        `);
        console.log('Similar Products in Mikro:', res);
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

searchProduct();
