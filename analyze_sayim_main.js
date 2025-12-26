const mssqlService = require('./services/mssql.service');

async function analyzeSayim() {
    try {
        console.log('Analyzing SAYIM_SONUCLARI...');
        const columns = await mssqlService.query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'SAYIM_SONUCLARI' ORDER BY ORDINAL_POSITION");

        // Split into chunks to avoid truncation visuals if too long, or just log names
        console.log(columns.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE}${c.CHARACTER_MAXIMUM_LENGTH ? '(' + c.CHARACTER_MAXIMUM_LENGTH + ')' : ''})`).join(', '));

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

analyzeSayim();
