require('dotenv').config();
const mssqlService = require('../services/mssql.service');

async function getSynonyms() {
    try {
        const res = await mssqlService.query(`
            SELECT * FROM sys.synonyms 
            WHERE base_object_name LIKE '%MikroDB_V15_03%' OR base_object_name LIKE '%MikroDB_V15_04%'
        `);
        console.log('Synonyms:', res.length > 0 ? res : 'No synonyms found linking to 03 or 04');
    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

getSynonyms();
