const mssql = require('./services/mssql.service');

async function main() {
    try {
        console.log("Connecting to MS SQL...");
        const pool = await mssql.connect();

        console.log("Updating STOKLAR table: SET sto_yer_kod = sto_reyon_kodu...");

        const result = await pool.request().query(`
      UPDATE STOKLAR
      SET sto_yer_kod = sto_reyon_kodu
      WHERE sto_reyon_kodu IS NOT NULL
    `);

        console.log(`Update successful! Rows affected: ${result.rowsAffected[0]}`);
    } catch (error) {
        console.error("Error updating STOKLAR:", error);
    } finally {
        await mssql.disconnect();
        process.exit(0);
    }
}

main();
