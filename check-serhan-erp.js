require('dotenv').config();
const mssqlService = require('./services/mssql.service');

(async () => {
    try {
        console.log('ERP SERHAN kayıtları kontrol ediliyor...');

        console.log('\n--- CARI_HESAP_HAREKETLERI (cha_grupno, cha_cinsi) ---');
        const hareketler = await mssqlService.query(`
            SELECT TOP 20 
                cha_RECno, cha_tarihi, cha_cinsi, cha_grupno, cha_evrak_tip
            FROM CARI_HESAP_HAREKETLERI 
            WHERE cha_kod = 'SERHAN'
            ORDER BY cha_RECno DESC
        `);
        console.table(hareketler);

        console.log('\n--- CARI_HESAP_HAREKETLERI_OZET (cho_GrupNo, cho_HareketCins) ---');
        const ozet = await mssqlService.query(`
            SELECT TOP 20
                cho_Cinsi, cho_GrupNo, cho_HareketCins, cho_MaliYil, cho_Donem
            FROM CARI_HESAP_HAREKETLERI_OZET 
            WHERE cho_CariKodu = 'SERHAN'
        `);
        console.table(ozet);

        await mssqlService.disconnect();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
