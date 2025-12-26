const mssqlService = require('./services/mssql.service');

async function peekChooseTables() {
    try {
        console.log('Peeking SAYIM_SONUCLARI_CHOOSE_2...');
        const res2 = await mssqlService.query("SELECT TOP 5 * FROM SAYIM_SONUCLARI_CHOOSE_2");
        console.log(JSON.stringify(res2, null, 2));

        console.log('Peeking SAYIM_SONUCLARI_CHOOSE_3...');
        const res3 = await mssqlService.query("SELECT TOP 5 * FROM SAYIM_SONUCLARI_CHOOSE_3");
        console.log(JSON.stringify(res3, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

peekChooseTables();
