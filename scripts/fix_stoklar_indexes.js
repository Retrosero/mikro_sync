const pgService = require('../services/postgresql.service');

async function fixStoklarIndexes() {
    try {
        console.log('--- Stoklar Tablosu Kontrolü ---');
        const duplicateStoklar = await pgService.query(`
      SELECT stok_kodu, COUNT(*)
      FROM stoklar
      GROUP BY stok_kodu
      HAVING COUNT(*) > 1
    `);
        console.log('Stoklar tablosunda tekrarlanan stok_kodu sayısı:', duplicateStoklar.length);
        if (duplicateStoklar.length > 0) {
            console.log('Tekrarlanan bazı stok kodları:', duplicateStoklar.slice(0, 5));
        }

        console.log('--- int_kodmap_stok Tablosu Kontrolü ---');
        const duplicateMap = await pgService.query(`
      SELECT erp_stok_kod, COUNT(*)
      FROM int_kodmap_stok
      GROUP BY erp_stok_kod
      HAVING COUNT(*) > 1
    `);
        console.log('int_kodmap_stok tablosunda tekrarlanan erp_stok_kod sayısı:', duplicateMap.length);

        console.log('--- İndeksler oluşturuluyor ---');

        // Stoklar tablosu için
        try {
            if (duplicateStoklar.length === 0) {
                await pgService.query(`
          ALTER TABLE stoklar ADD CONSTRAINT unique_stok_kodu UNIQUE (stok_kodu);
        `);
                console.log('✓ stoklar(stok_kodu) için UNIQUE kısıtı eklendi.');
            } else {
                console.log('⚠ stoklar tablosunda çift kayıtlar olduğu için kısıt eklenemedi.');
            }
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('(!) stoklar(stok_kodu) kısıtı zaten var.');
            } else {
                console.error('Hata (stoklar):', e.message);
            }
        }

        // int_kodmap_stok tablosu için
        try {
            if (duplicateMap.length === 0) {
                await pgService.query(`
          ALTER TABLE int_kodmap_stok ADD CONSTRAINT unique_erp_stok_kod UNIQUE (erp_stok_kod);
        `);
                console.log('✓ int_kodmap_stok(erp_stok_kod) için UNIQUE kısıtı eklendi.');
            } else {
                console.log('⚠ int_kodmap_stok tablosunda çift kayıtlar olduğu için kısıt eklenemedi.');
            }
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('(!) int_kodmap_stok(erp_stok_kod) kısıtı zaten var.');
            } else {
                console.error('Hata (int_kodmap_stok):', e.message);
            }
        }

    } catch (err) {
        console.error('Genel Hata:', err);
    } finally {
        await pgService.disconnect();
    }
}

fixStoklarIndexes();
