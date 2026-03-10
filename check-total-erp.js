const mssqlService = require('./services/mssql.service');

async function checkTotalErp() {
    try {
        const total = await mssqlService.query("SELECT COUNT(*) as count FROM STOKLAR");
        const active = await mssqlService.query("SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 0");
        const passive = await mssqlService.query("SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 1");

        console.log(JSON.stringify({
            total: total[0].count,
            active: active[0].count,
            passive: passive[0].count
        }));

        const last10 = await mssqlService.query("SELECT TOP 10 sto_kod, sto_isim, sto_pasif_fl, sto_lastup_date FROM STOKLAR ORDER BY sto_lastup_date DESC");
        console.log('Last 10 ERP updates:');
        last10.forEach(row => console.log(JSON.stringify(row)));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkTotalErp();
