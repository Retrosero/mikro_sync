require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkCounts() {
    const tables = ['stoklar', 'cari_hesaplar', 'barkod_tanimlari', 'stok_satis_fiyat_listeleri', 'int_kodmap_stok', 'int_kodmap_cari'];

    console.log('Tablo Kayıt Sayıları:');
    for (const table of tables) {
        const result = await pgService.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  ${table}: ${result[0].count}`);
    }

    await pgService.disconnect();
    process.exit(0);
}

checkCounts();
