require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function fixMapping() {
    try {
        const customerId = 'a07078d2-eb8a-4168-9eb8-0cb3ff8de1ca';
        const erpCode = 'PKR-ADENYA OTEL'; // From find-customer.js output

        console.log(`Checking mapping for customer ${customerId}...`);

        // Check if mapping exists
        const mapping = await pgService.queryOne(`
            SELECT * FROM int_kodmap_cari 
            WHERE web_cari_id = $1
        `, [customerId]);

        if (mapping) {
            console.log("Mapping already exists:", mapping);
        } else {
            console.log("Mapping missing. Creating...");
            await pgService.query(`
                INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
                VALUES ($1, $2)
            `, [customerId, erpCode]);
            console.log("✓ Mapping created.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pgService.disconnect();
    }
}

fixMapping();
