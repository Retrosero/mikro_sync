const pgService = require('../services/postgresql.service');

async function checkFinalCount() {
    try {
        const res = await pgService.query("SELECT COUNT(*) FROM stoklar WHERE resim_url IS NULL OR resim_url = ''");
        console.log("Products without resim_url:", res[0].count);
        
        const withPics = await pgService.query("SELECT COUNT(*) FROM stoklar WHERE resim_url IS NOT NULL AND resim_url != ''");
        console.log("Products with resim_url:", withPics[0].count);
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

checkFinalCount();
