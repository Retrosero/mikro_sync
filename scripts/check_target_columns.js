const pgService = require('../services/postgresql.service');

(async () => {
    try {
        const tables = ['cari_hesap_hareketleri', 'stok_hareketleri'];
        const targetColumns = ['fatura_seri_no', 'fatura_sira_no'];

        for (const table of tables) {
            const res = await pgService.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = $1
            `, [table]);

            const existingColumns = res.map(r => r.column_name);
            console.log(`\nTable: ${table}`);

            for (const col of targetColumns) {
                const exists = existingColumns.includes(col);
                console.log(`  - ${col}: ${exists ? 'EXISTS' : 'MISSING'}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pgService.disconnect();
    }
})();
