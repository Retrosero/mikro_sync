require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function verify() {
    try {
        const kasalarCount = await pgService.query("SELECT COUNT(*) as count FROM kasalar");
        console.log('Kasalar Count:', kasalarCount[0].count);

        const bankalarCount = await pgService.query("SELECT COUNT(*) as count FROM bankalar");
        console.log('Bankalar Count:', bankalarCount[0].count);

        const bankalarWithKod = await pgService.query("SELECT COUNT(*) as count FROM bankalar WHERE ban_kod IS NOT NULL");
        console.log('Bankalar with ban_kod:', bankalarWithKod[0].count);

        const cariHareketWithKasa = await pgService.query("SELECT COUNT(*) as count FROM cari_hesap_hareketleri WHERE cha_kasa_hizkod IS NOT NULL");
        console.log('Cari Hareket with cha_kasa_hizkod:', cariHareketWithKasa[0].count);

    } catch (error) {
        console.error(error);
    } finally {
        await pgService.disconnect();
    }
}

verify();
