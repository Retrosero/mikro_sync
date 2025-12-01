require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkMssqlSales() {
    try {
        const evrakNo = 'TEST-SERHAN-004';
        console.log(`Checking MSSQL for document: ${evrakNo}`);

        // Check STOK_HAREKETLERI
        // Using sth_belge_no instead of sth_evrakno
        const sth = await mssqlService.query(`
            SELECT TOP 1 * FROM STOK_HAREKETLERI WHERE sth_belge_no = @evrakNo
        `, { evrakNo });

        if (sth.length > 0) {
            console.log("Found in STOK_HAREKETLERI:", sth[0]);
        } else {
            console.log("Not found in STOK_HAREKETLERI");
        }

        // Check CARI_HESAP_HAREKETLERI
        const cha = await mssqlService.query(`
            SELECT TOP 1 * FROM CARI_HESAP_HAREKETLERI WHERE cha_belge_no = @evrakNo
        `, { evrakNo });

        if (cha.length > 0) {
            console.log("Found in CARI_HESAP_HAREKETLERI:", cha[0]);
        } else {
            console.log("Not found in CARI_HESAP_HAREKETLERI");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await mssqlService.disconnect();
    }
}

checkMssqlSales();
