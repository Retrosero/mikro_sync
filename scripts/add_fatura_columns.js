const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

(async () => {
    try {
        const tables = ['cari_hesap_hareketleri', 'stok_hareketleri'];
        const columns = [
            { name: 'fatura_seri_no', type: 'VARCHAR(50)' },
            { name: 'fatura_sira_no', type: 'VARCHAR(50)' } // Using VARCHAR to be safe with leading zeros or large numbers
        ];

        for (const table of tables) {
            for (const col of columns) {
                try {
                    // Check if column exists
                    const checkRes = await pgService.query(`
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = $1 AND column_name = $2
                    `, [table, col.name]);

                    if (checkRes.length === 0) {
                        logger.info(`Adding ${col.name} to ${table}...`);
                        await pgService.query(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`);
                        logger.info(`Added ${col.name} to ${table}.`);
                    } else {
                        logger.info(`${col.name} already exists in ${table}.`);
                    }
                } catch (e) {
                    logger.error(`Error adding ${col.name} to ${table}:`, e.message);
                }
            }
        }
        logger.info('Column addition process completed.');
    } catch (err) {
        logger.error('Script error:', err);
    } finally {
        await pgService.disconnect();
    }
})();
