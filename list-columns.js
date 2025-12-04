require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function listColumns() {
    try {
        console.log('STOK_HAREKETLERI kolonları listeleniyor...\n');

        const query = `
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'STOK_HAREKETLERI'
            AND COLUMN_NAME LIKE '%special%'
        `;

        const result = await mssqlService.query(query);
        console.table(result);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

listColumns();
