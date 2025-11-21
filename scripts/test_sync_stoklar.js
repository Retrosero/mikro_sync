const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const stokProcessor = require('../sync-jobs/stok.processor');
const logger = require('../utils/logger');

async function syncStoksFromERP() {
    try {
        console.log('ERP\'den stoklar çekiliyor...');

        // İlk 10 stoku çek (test için)
        const stoklar = await mssqlService.query(`
      SELECT TOP 10 
        sto_kod, sto_isim, sto_birim1_ad, sto_standartmaliyet,
        sto_sektor_kodu, sto_reyon_kodu, sto_ambalaj_kodu, 
        sto_kalkon_kodu, sto_yabanci_isim
      FROM STOKLAR
      WHERE sto_kod IS NOT NULL AND sto_isim IS NOT NULL
      ORDER BY sto_kod
    `);

        console.log(`${stoklar.length} stok bulundu. Senkronize ediliyor...`);

        for (const stok of stoklar) {
            try {
                await stokProcessor.syncToWeb(stok);
                console.log(`✓ ${stok.sto_kod} - ${stok.sto_isim}`);
            } catch (error) {
                console.error(`✗ ${stok.sto_kod} hatası:`, error.message);
            }
        }

        console.log('\nSenkronizasyon tamamlandı!');

        // Özet bilgi
        const webStokCount = await pgService.queryOne('SELECT COUNT(*) as count FROM stoklar');
        console.log(`Web tarafında toplam ${webStokCount.count} stok var.`);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

syncStoksFromERP();
