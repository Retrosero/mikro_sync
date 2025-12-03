require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkErpCariHareketCount() {
    try {
        // ERP'deki toplam kayıt
        const count = await mssqlService.query('SELECT COUNT(*) as count FROM CARI_HESAP_HAREKETLERI');
        console.log(`ERP'deki toplam: ${count[0].count}`);

        // Banka kodları
        const bankaKodlari = await mssqlService.query('SELECT ban_kod FROM BANKALAR');
        console.log(`Banka kodu sayısı: ${bankaKodlari.length}`);
        console.log('Banka kodları:', bankaKodlari.map(b => b.ban_kod).join(', '));

        // Banka kodlu kayıtlar
        const bankaCodes = bankaKodlari.map(b => `'${b.ban_kod}'`).join(',');
        const bankaCount = await mssqlService.query(`SELECT COUNT(*) as count FROM CARI_HESAP_HAREKETLERI WHERE cha_kod IN (${bankaCodes})`);
        console.log(`\nBanka kodlu kayıt: ${bankaCount[0].count}`);

        // Banka kodlu VE cha_ciro_cari_kodu dolu
        const bankaWithCiro = await mssqlService.query(`SELECT COUNT(*) as count FROM CARI_HESAP_HAREKETLERI WHERE cha_kod IN (${bankaCodes}) AND cha_ciro_cari_kodu IS NOT NULL AND cha_ciro_cari_kodu != ''`);
        console.log(`Banka kodlu + ciro_cari_kodu dolu: ${bankaWithCiro[0].count}`);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkErpCariHareketCount();
