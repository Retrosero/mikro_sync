require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function findCustomer() {
    try {
        console.log("Searching for customer 'serhan'...");
        const customer = await pgService.queryOne(`
            SELECT * FROM cari_hesaplar 
            WHERE cari_kodu ILIKE '%serhan%' OR cari_adi ILIKE '%serhan%'
        `);

        if (customer) {
            console.log("Found customer:", customer);
        } else {
            console.log("Customer not found.");
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pgService.disconnect();
    }
}

findCustomer();
