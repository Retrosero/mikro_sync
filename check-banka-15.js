require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function checkBanka15() {
    try {
        // 15 banka kodu mu?
        const banka15 = await mssqlService.query(`
            SELECT ban_kod FROM BANKALAR WHERE ban_kod = '15'
        `);

        console.log('Banka kodu "15" kontrolü:');
        if (banka15.length > 0) {
            console.log('✓ "15" bir banka kodudur\n');
        } else {
            console.log('✗ "15" banka kodu değil\n');
        }

        // Tüm banka kodları
        const tumBankalar = await mssqlService.query('SELECT ban_kod FROM BANKALAR');
        console.log(`Toplam ${tumBankalar.length} banka kodu var:`);
        console.log(tumBankalar.map(b => b.ban_kod).join(', '));

        // Web'de SERHAN var mı?
        console.log('\n\nWeb\'de "SERHAN" aranıyor...');
        const serhan = await pgService.query(
            "SELECT id, cari_kodu, cari_adi FROM cari_hesaplar WHERE cari_adi ILIKE '%SERHAN%'"
        );

        if (serhan.length > 0) {
            console.log('Bulunan cariler:');
            console.table(serhan);
        } else {
            console.log('✗ SERHAN içeren cari yok');

            // Tüm cari sayısı
            const count = await pgService.query('SELECT COUNT(*) as count FROM cari_hesaplar');
            console.log(`\nWeb'de toplam ${count[0].count} cari var`);
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

checkBanka15();
