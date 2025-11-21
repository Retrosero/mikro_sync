require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function findColumns() {
    try {
        const result = await mssqlService.query('SELECT TOP 1 * FROM STOKLAR');
        const columns = Object.keys(result[0]);

        const keywords = ['marka', 'beden', 'olcu', 'koli', 'raf', 'yer', 'ambalaj'];
        const relevant = columns.filter(c => keywords.some(k => c.toLowerCase().includes(k)));

        console.log('Relevant Columns:', relevant);
        console.log('All Columns:', columns);

        await mssqlService.disconnect();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

findColumns();
