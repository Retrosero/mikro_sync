const pgService = require('../services/postgresql.service');

async function debugMismatch() {
    try {
        const res = await pgService.query(`
            SELECT 
                s.stok_kodu as stoklar_code,
                LENGTH(s.stok_kodu) as stoklar_len,
                p."productCode" as entegra_code,
                LENGTH(p."productCode") as entegra_len
            FROM stoklar s
            JOIN entegra_product p ON TRIM(s.stok_kodu) = TRIM(p."productCode")
            WHERE s.stok_kodu != p."productCode"
            LIMIT 10
        `);
        console.table(res);

        const caseRes = await pgService.query(`
            SELECT 
                s.stok_kodu as stoklar_code,
                p."productCode" as entegra_code
            FROM stoklar s
            JOIN entegra_product p ON LOWER(TRIM(s.stok_kodu)) = LOWER(TRIM(p."productCode"))
            WHERE s.stok_kodu != p."productCode"
            LIMIT 10
        `);
        console.table(caseRes);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

debugMismatch();
