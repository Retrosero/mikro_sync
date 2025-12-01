require('dotenv').config();
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function checkTables() {
    try {
        // Stoklar columns
        const stokCols = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'stoklar'");
        console.log('Stoklar Columns:', stokCols.map(c => c.column_name));

        // Markalar table
        const markalarExists = await pgService.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'markalar'");
        console.log('Markalar table exists:', markalarExists.length > 0);

        if (markalarExists.length > 0) {
            const markaCols = await pgService.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'markalar'");
            console.log('Markalar Columns:', markaCols.map(c => c.column_name));
        }

        // ERP STOKLAR columns
        const erpStoklar = await mssqlService.query("SELECT TOP 1 * FROM STOKLAR");
        if (erpStoklar.length > 0) {
            console.log('ERP STOKLAR Columns:', Object.keys(erpStoklar[0]));
        }

    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

checkTables();
