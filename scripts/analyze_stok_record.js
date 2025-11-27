const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

(async () => {
    try {
        const query = `
            SELECT sth_evraktip, sth_tip, sth_cins, sth_normal_iade, sth_evrakno_seri, sth_evrakno_sira
            FROM STOK_HAREKETLERI
            WHERE sth_evrakno_sira = '202' AND sth_normal_iade = 1
        `;

        const result = await mssqlService.query(query);
        console.log('--- Stok Hareketleri Query Result ---');
        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        logger.error('Error querying MSSQL:', err);
    } finally {
        await mssqlService.disconnect();
    }
})();
