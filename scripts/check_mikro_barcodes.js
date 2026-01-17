require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkBarcodes() {
    const productCode = '6056902';
    try {
        console.log(`Barkod kontrolü: ${productCode}`);

        // Bu ürün koduna bağlı barkodlar
        const b1 = await mssqlService.query(`SELECT * FROM BARKOD_TANIMLARI WHERE bar_stokkodu = '${productCode}'`);
        console.log('Ürün koduna bağlı barkodlar:', b1);

        // Bu ürün kodu barkod ise hangi stok koduna bağlı?
        const b2 = await mssqlService.query(`SELECT * FROM BARKOD_TANIMLARI WHERE bar_kodu = '${productCode}'`);
        console.log('Bu kodun barkod olarak bağlı olduğu stok kodları:', b2);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkBarcodes();
