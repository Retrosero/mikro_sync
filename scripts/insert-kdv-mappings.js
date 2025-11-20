require('dotenv').config();
const mssqlService = require('../services/mssql.service');
const fs = require('fs').promises;

async function insertKdvMappings() {
    try {
        console.log('KDV Pointer mapping\'leri ekleniyor...');

        // Read JSON file
        const data = JSON.parse(await fs.readFile('mapping_int_kdvpointermap.json', 'utf8'));

        console.log(`${data.length} KDV mapping bulundu`);

        // Clear existing mappings
        await mssqlService.query('DELETE FROM INT_KdvPointerMap');
        console.log('Mevcut mappingler temizlendi');

        // Insert new mappings
        for (const row of data) {
            await mssqlService.query(`
        INSERT INTO INT_KdvPointerMap (kdv_oran, vergi_pntr)
        VALUES (${row.KdvOran}, ${row.VergiPntr})
      `);
            console.log(`✓ KDV ${row.KdvOran}% → Pointer ${row.VergiPntr}`);
        }

        console.log('\n✅ KDV mappingler başarıyla eklendi');

        await mssqlService.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Hata:', error.message);
        await mssqlService.disconnect();
        process.exit(1);
    }
}

insertKdvMappings();
