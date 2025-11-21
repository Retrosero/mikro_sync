require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkRaf() {
    try {
        const pgResult = await pgService.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'stoklar' AND column_name = 'raf_kodu'");
        console.log('raf_kodu type:', pgResult[0] ? pgResult[0].data_type : 'Not found');
        await pgService.disconnect();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkRaf();
