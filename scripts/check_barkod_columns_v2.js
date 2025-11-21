const mssqlService = require('../services/mssql.service');

async function checkColumns() {
    try {
        console.log('Kolon denemesi yapılıyor...\n');

        try {
            await mssqlService.query('SELECT TOP 1 bar_kodu FROM BARKOD_TANIMLARI');
            console.log('✅ bar_kodu MEVCUT');
        } catch (e) {
            console.log('❌ bar_kodu YOK');
        }

        try {
            await mssqlService.query('SELECT TOP 1 bar_stokkodu FROM BARKOD_TANIMLARI');
            console.log('✅ bar_stokkodu MEVCUT');
        } catch (e) {
            console.log('❌ bar_stokkodu YOK');
        }

        try {
            await mssqlService.query('SELECT TOP 1 bar_stok_kodu FROM BARKOD_TANIMLARI');
            console.log('✅ bar_stok_kodu MEVCUT');
        } catch (e) {
            console.log('❌ bar_stok_kodu YOK');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkColumns();
