require('dotenv').config();
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

async function checkProduct() {
    const productCode = '6056902';
    try {
        logger.info(`MS SQL'de ürün kontrol ediliyor: ${productCode}`);

        const query = `
            SELECT
                S.sto_RECno AS product_id,
                LTRIM(RTRIM(S.sto_kod)) AS Product_code,
                S.sto_isim AS Name,
                ISNULL(SHM.sth_eldeki_miktar, 0) AS stock
            FROM
                STOKLAR S WITH (NOLOCK)
            LEFT JOIN
                STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW SHM WITH (NOLOCK) ON S.sto_kod = SHM.sth_stok_kod
            WHERE 
                LTRIM(RTRIM(S.sto_kod)) = '${productCode}'
        `;

        const rows = await mssqlService.query(query);
        console.log('MS SQL Sonucu:', JSON.stringify(rows, null, 2));

        if (rows.length === 0) {
            console.log('Ürün MS SQL\'de bulunamadı.');
        }

    } catch (error) {
        logger.error('Hata:', error);
    } finally {
        await mssqlService.disconnect();
    }
}

checkProduct();
