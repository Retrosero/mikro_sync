const mssqlService = require('../services/mssql.service');

async function checkColumns() {
    try {
        console.log('Kolon denemesi yapılıyor...\n');

        // BARKOD_TANIMLARI
        try {
            await mssqlService.query('SELECT TOP 1 bar_kodu FROM BARKOD_TANIMLARI');
            console.log('✅ BARKOD_TANIMLARI.bar_kodu MEVCUT');
        } catch (e) {
            console.log('❌ BARKOD_TANIMLARI.bar_kodu YOK');
        }

        try {
            await mssqlService.query('SELECT TOP 1 bar_kod FROM BARKOD_TANIMLARI');
            console.log('✅ BARKOD_TANIMLARI.bar_kod MEVCUT');
        } catch (e) {
            console.log('❌ BARKOD_TANIMLARI.bar_kod YOK');
        }

        // CARI_HESAPLAR
        try {
            await mssqlService.query('SELECT TOP 1 cari_kod FROM CARI_HESAPLAR');
            console.log('✅ CARI_HESAPLAR.cari_kod MEVCUT');
        } catch (e) {
            console.log('❌ CARI_HESAPLAR.cari_kod YOK');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkColumns();
