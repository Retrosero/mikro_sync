require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function debugStock() {
    const productCode = '6056902';
    try {
        console.log(`Mikro'da detaylı stok kontrolü: ${productCode}`);

        // View sonucunu kontrol et
        const viewRes = await mssqlService.query(`SELECT * FROM STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW WHERE sth_stok_kod = '${productCode}'`);
        console.log('View Sonucu:', viewRes);

        // Ham hareketleri kontrol et (özet)
        const hareketRes = await mssqlService.query(`
            SELECT 
                sth_stok_kod,
                SUM(CASE WHEN sth_giris_cikis = 0 THEN sth_miktar ELSE -sth_miktar END) as hesaplanan_stok
            FROM STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}'
            GROUP BY sth_stok_kod
        `);
        console.log('Hesaplanan Stok (Ham Hareketler):', hareketRes);

        // Depo bazlı stok
        const depoRes = await mssqlService.query(`
            SELECT 
                sth_depo_no,
                SUM(CASE WHEN sth_giris_cikis = 0 THEN sth_miktar ELSE -sth_miktar END) as depo_stok
            FROM STOK_HAREKETLERI WITH (NOLOCK)
            WHERE sth_stok_kod = '${productCode}'
            GROUP BY sth_depo_no
        `);
        console.log('Depo Bazlı Stok:', depoRes);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mssqlService.disconnect();
    }
}

debugStock();
