require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function checkDepots() {
    const productCode = '6056902';
    try {
        console.log(`Mikro (V15_02) Depo Bazlı Stok: ${productCode}`);

        const res = await mssqlService.query(`
            SELECT 
                d.depo_no,
                d.depo_isim,
                ISNULL(SUM(CASE WHEN sth_tip = 0 THEN sth_miktar ELSE -sth_miktar END), 0) as depo_stok
            FROM dbo.DEPOLAR d WITH (NOLOCK)
            LEFT JOIN dbo.STOK_HAREKETLERI h WITH (NOLOCK) ON (h.sth_giris_depo_no = d.depo_no OR h.sth_cikis_depo_no = d.depo_no) AND h.sth_stok_kod = '${productCode}'
            GROUP BY d.depo_no, d.depo_isim
            HAVING ISNULL(SUM(CASE WHEN sth_tip = 0 THEN sth_miktar ELSE -sth_miktar END), 0) <> 0
        `);
        console.log('Depo Bazlı Sonuçlar:', res);

        // Wait, the join condition above is tricky for exits. 
        // In Mikro, if it's an exit (tip=1), it usually has a cikis_depo_no. 
        // If it's an entry (tip=0), it has a giris_depo_no.

        const res2 = await mssqlService.query(`
            SELECT 
                depo_no,
                SUM(miktar) as stok
            FROM (
                SELECT sth_giris_depo_no as depo_no, sth_miktar as miktar FROM STOK_HAREKETLERI WHERE sth_stok_kod = '${productCode}' AND sth_tip = 0
                UNION ALL
                SELECT sth_cikis_depo_no as depo_no, -sth_miktar as miktar FROM STOK_HAREKETLERI WHERE sth_stok_kod = '${productCode}' AND sth_tip = 1
            ) t
            GROUP BY depo_no
        `);
        console.log('Depo Bazlı Net (0 ve 1 ayrımı):', res2);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkDepots();
