const pgService = require('../services/postgresql.service');

async function checkTransferResults() {
    try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('  VERİ AKTARIM SONUÇLARI');
        console.log('═══════════════════════════════════════════════════════\n');

        // Stok sayısı
        const stokCount = await pgService.queryOne('SELECT COUNT(*) as count FROM stoklar');
        console.log(`📦 Toplam Stok        : ${stokCount.count}`);

        // Barkod sayısı
        const barkodCount = await pgService.queryOne('SELECT COUNT(*) as count FROM urun_barkodlari');
        console.log(`🏷️  Toplam Barkod      : ${barkodCount.count}`);

        // Fiyat sayısı
        const fiyatCount = await pgService.queryOne('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
        console.log(`💰 Toplam Fiyat       : ${fiyatCount.count}`);

        // Mapping sayıları
        console.log('\n📊 Mapping Tabloları:');

        const stokMapping = await pgService.queryOne('SELECT COUNT(*) as count FROM int_kodmap_stok');
        console.log(`   Stok Mapping       : ${stokMapping.count}`);

        const fiyatMapping = await pgService.queryOne('SELECT COUNT(*) as count FROM int_kodmap_fiyat_liste');
        console.log(`   Fiyat Mapping      : ${fiyatMapping.count}`);

        const cariMapping = await pgService.queryOne('SELECT COUNT(*) as count FROM int_kodmap_cari');
        console.log(`   Cari Mapping       : ${cariMapping.count}`);

        // Son eklenen stoklar
        console.log('\n📋 Son Eklenen 5 Stok:');
        const lastStocks = await pgService.query(`
      SELECT stok_kodu, stok_adi, alis_fiyati, olusturma_tarihi
      FROM stoklar
      ORDER BY olusturma_tarihi DESC
      LIMIT 5
    `);

        lastStocks.forEach((stok, index) => {
            const tarih = new Date(stok.olusturma_tarihi).toLocaleString('tr-TR');
            console.log(`   ${index + 1}. ${stok.stok_kodu} - ${stok.stok_adi.substring(0, 40)}... (${tarih})`);
        });

        // Barkodu olan stoklar
        const stokWithBarcode = await pgService.queryOne(`
      SELECT COUNT(DISTINCT stok_id) as count 
      FROM urun_barkodlari
    `);
        console.log(`\n✅ Barkodu Olan Stok  : ${stokWithBarcode.count}`);

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('✅ Veri aktarımı başarıyla tamamlandı!');
        console.log('═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkTransferResults();
