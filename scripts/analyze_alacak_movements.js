const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

(async () => {
    try {
        const query = `
            SELECT cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_Iade, cha_tpoz, cha_cari_cins, COUNT(*) as count
            FROM CARI_HESAP_HAREKETLERI
            WHERE cha_tip = 1
            GROUP BY cha_evrak_tip, cha_tip, cha_cinsi, cha_normal_Iade, cha_tpoz, cha_cari_cins
            ORDER BY count DESC
        `;

        const result = await mssqlService.query(query);
        console.log('--- Distribution of Alacak (Credit) Movements ---');
        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        logger.error('Error querying MSSQL:', err);
    } finally {
        await mssqlService.disconnect();
    }
})();
