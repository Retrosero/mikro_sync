require('dotenv').config();
const stokProcessor = require('../sync-jobs/stok.processor');
const pgService = require('../services/postgresql.service');

async function testMap() {
    try {
        console.log('Kategoriler yükleniyor...');
        await stokProcessor.loadCategories();
        console.log(`${stokProcessor.categoryMap.size} kategori yüklendi.`);

        const searchKey = 'O-39';
        console.log(`Aranan Anahtar: '${searchKey}'`);

        if (stokProcessor.categoryMap.has(searchKey)) {
            console.log(`✅ Anahtar bulundu! ID: ${stokProcessor.categoryMap.get(searchKey)}`);
        } else {
            console.log('❌ Anahtar bulunamadı.');
            console.log('Map içeriği (tümü):');
            for (const key of stokProcessor.categoryMap.keys()) {
                console.log(`'${key}'`);
            }
        }

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
    }
}

testMap();
