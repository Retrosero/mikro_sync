const mssqlService = require('./services/mssql.service');

async function analyzeTables() {
    try {
        console.log('Analyzing SAYIM_SONUCLARI...');
        const sayimColumns = await mssqlService.query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SAYIM_SONUCLARI'");
        console.log(JSON.stringify(sayimColumns, null, 2));

        console.log('\nAnalyzing SAYIM_SONUCLARI_CHOOSE_2...');
        const choose2Columns = await mssqlService.query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SAYIM_SONUCLARI_CHOOSE_2'");
        console.log(JSON.stringify(choose2Columns, null, 2));

        console.log('\nAnalyzing SAYIM_SONUCLARI_CHOOSE_3...');
        const choose3Columns = await mssqlService.query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SAYIM_SONUCLARI_CHOOSE_3'");
        console.log(JSON.stringify(choose3Columns, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

analyzeTables();
