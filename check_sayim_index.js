const mssqlService = require('./services/mssql.service');

async function checkSayimIndex() {
    try {
        console.log('Checking index NDX_SAYIM_SONUCLARI_02...');
        const res = await mssqlService.query("EXEC sp_helpindex 'SAYIM_SONUCLARI'");

        const index = res.filter(i => i.index_name === 'NDX_SAYIM_SONUCLARI_02');
        console.log(index);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkSayimIndex();
