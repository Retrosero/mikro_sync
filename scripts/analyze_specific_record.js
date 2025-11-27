const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

(async () => {
    try {
        const query = `
            SELECT cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_Iade, cha_tpoz, cha_evrakno_seri, cha_evrakno_sira, cha_aciklama
            FROM CARI_HESAP_HAREKETLERI
            WHERE cha_evrakno_sira = '202'
              AND cha_kod = 'AHMET ER'
        `;

        const result = await mssqlService.query(query);
        console.log('--- Query Result ---');
        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        logger.error('Error querying MSSQL:', err);
    } finally {
        await mssqlService.disconnect();
    }
})();
