require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function inspectMapping() {
    try {
        const erpCode = 'PKR-ADENYA OTEL';
        const targetWebId = 'a07078d2-eb8a-4168-9eb8-0cb3ff8de1ca';

        console.log(`Inspecting mapping for ERP Code: ${erpCode}`);

        const existingMapping = await pgService.queryOne(`
            SELECT * FROM int_kodmap_cari 
            WHERE erp_cari_kod = $1
        `, [erpCode]);

        if (existingMapping) {
            console.log("Found existing mapping:", existingMapping);

            if (existingMapping.web_cari_id !== targetWebId) {
                console.log(`! CONFLICT: Mapped to ${existingMapping.web_cari_id}, but we want ${targetWebId}`);

                // Check who is that other customer
                const otherCustomer = await pgService.queryOne(`
                    SELECT * FROM cari_hesaplar WHERE id = $1
                `, [existingMapping.web_cari_id]);
                console.log("The other customer is:", otherCustomer);

                // Update the mapping to point to the correct customer
                console.log("Updating mapping to point to the correct customer...");
                await pgService.query(`
                    UPDATE int_kodmap_cari 
                    SET web_cari_id = $1 
                    WHERE erp_cari_kod = $2
                `, [targetWebId, erpCode]);
                console.log("✓ Mapping updated.");
            } else {
                console.log("Mapping is already correct.");
            }
        } else {
            console.log("No mapping found for this ERP code.");
            // Create it
            console.log("Creating mapping...");
            await pgService.query(`
                INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
                VALUES ($1, $2)
            `, [targetWebId, erpCode]);
            console.log("✓ Mapping created.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await pgService.disconnect();
    }
}

inspectMapping();
