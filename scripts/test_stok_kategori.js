require('dotenv').config();
const stokProcessor = require('../sync-jobs/stok.processor');
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function testStokKategoriSync() {
    try {
        console.log('--- TEST BAŞLIYOR ---');

        // 1. Kategorileri yükle
        console.log('Kategoriler yükleniyor...');
        await stokProcessor.loadCategories();
        console.log(`${stokProcessor.categoryMap.size} kategori yüklendi.`);

        // 2. ERP'den grup kodu olan bir stok bul
        console.log('ERP\'den örnek stok aranıyor...');
        const sampleStok = await mssqlService.query(`
            SELECT TOP 1 * FROM STOKLAR 
            WHERE sto_pasif_fl = 0 
            AND (sto_altgrup_kod != '' OR sto_anagrup_kod != '')
        `);

        if (sampleStok.length === 0) {
            console.log('Test için uygun stok bulunamadı.');
            return;
        }

        const erpStok = sampleStok[0];
        console.log(`Örnek Stok: ${erpStok.sto_kod}, Alt: '${erpStok.sto_altgrup_kod}'`);

        // 3. Senkronizasyonu çalıştır (Tek stok için)
        console.log('Stok senkronize ediliyor...');
        await stokProcessor.syncSingleStokToWeb(erpStok);

        // 4. Sonucu kontrol et
        const webStok = await pgService.queryOne(
            `SELECT s.id, s.kategori_id
             FROM stoklar s
             WHERE s.stok_kodu = $1`,
            [erpStok.sto_kod]
        );

        console.log('Web Sonuç:');
        console.log(`Stok ID: ${webStok.id}`);
        console.log(`Kategori ID: ${webStok.kategori_id}`);

        if (webStok.kategori_id) {
            console.log('✅ TEST BAŞARILI');
        } else {
            console.log('❌ TEST BAŞARISIZ');
        }

    } catch (error) {
        console.error('Test Hatası:', error);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

testStokKategoriSync();
