require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkColumns() {
    try {
        console.log("Checking columns for 'satislar'...");
        const satislarColumns = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'satislar'
        `);
        console.log(satislarColumns);

        console.log("\nChecking columns for 'satis_kalemleri'...");
        const kalemlerColumns = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'satis_kalemleri'
        `);
        console.log(kalemlerColumns);

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pgService.disconnect();
    }
}

checkColumns();
