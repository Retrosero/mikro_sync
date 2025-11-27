const pgService = require('../services/postgresql.service');

async function checkResults() {
    try {
        // Cari Hesap Hareketleri belge tipleri
        console.log('\n=== CARİ HESAP HAREKETLERİ BELGE TİPLERİ ===');
        const cariResults = await pgService.query(`
      SELECT belge_tipi, COUNT(*) as adet
      FROM cari_hesap_hareketleri
      GROUP BY belge_tipi
      ORDER BY adet DESC
    `);
        cariResults.forEach(row => {
            console.log(`${row.belge_tipi}: ${row.adet} kayıt`);
        });

        // Stok Hareketleri belge tipleri
        console.log('\n=== STOK HAREKETLERİ BELGE TİPLERİ ===');
        const stokResults = await pgService.query(`
      SELECT belge_tipi, COUNT(*) as adet
      FROM stok_hareketleri
      GROUP BY belge_tipi
      ORDER BY adet DESC
    `);
        stokResults.forEach(row => {
            console.log(`${row.belge_tipi}: ${row.adet} kayıt`);
        });

        // Örnek kayıtlar
        console.log('\n=== CARİ HESAP HAREKETLERİ ÖRNEK KAYITLAR ===');
        const cariSamples = await pgService.query(`
      SELECT belge_tipi, hareket_tipi, belge_no, tutar, islem_tarihi
      FROM cari_hesap_hareketleri
      ORDER BY islem_tarihi DESC
      LIMIT 10
    `);
        cariSamples.forEach(row => {
            console.log(`${row.belge_tipi} | ${row.hareket_tipi} | ${row.belge_no} | ${row.tutar} TL | ${row.islem_tarihi.toISOString().split('T')[0]}`);
        });

        console.log('\n=== STOK HAREKETLERİ ÖRNEK KAYITLAR ===');
        const stokSamples = await pgService.query(`
      SELECT belge_tipi, hareket_tipi, belge_no, miktar, toplam_tutar, islem_tarihi
      FROM stok_hareketleri
      ORDER BY islem_tarihi DESC
      LIMIT 10
    `);
        stokSamples.forEach(row => {
            console.log(`${row.belge_tipi} | ${row.hareket_tipi} | ${row.belge_no} | ${row.miktar} adet | ${row.toplam_tutar} TL | ${row.islem_tarihi.toISOString().split('T')[0]}`);
        });

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkResults();
