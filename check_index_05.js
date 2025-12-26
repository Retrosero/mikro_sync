const mssqlService = require('./services/mssql.service');

async function checkIndex() {
    try {
        console.log('Checking index NDX_STOK_HAREKETLERI_05...');
        const res = await mssqlService.query("EXEC sp_helpindex 'STOK_HAREKETLERI'");

        // Filter for specific index
        const index = res.filter(i => i.index_name === 'NDX_STOK_HAREKETLERI_05');
        console.log(index);

    } catch (e) {
        console.error(e);
    } finally {
        await mssqlService.disconnect();
    }
}

checkIndex();
