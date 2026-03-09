const pgService = require('../services/postgresql.service');

async function checkMoreIndexes() {
    try {
        console.log('--- urun_barkodlari Tablosu Kontrolü ---');
        const b_res = await pgService.query(`
      SELECT
          conname AS constraint_name
      FROM
          pg_constraint
      WHERE
          conrelid = 'urun_barkodlari'::regclass;
    `);
        console.log('CONSTRAINTS (urun_barkodlari):', b_res);

        console.log('--- urun_fiyat_listeleri Tablosu Kontrolü ---');
        const f_res = await pgService.query(`
      SELECT
          conname AS constraint_name
      FROM
          pg_constraint
      WHERE
          conrelid = 'urun_fiyat_listeleri'::regclass;
    `);
        console.log('CONSTRAINTS (urun_fiyat_listeleri):', f_res);

        // urun_barkodlari için UNIQUE (barkod) olmalı
        if (!b_res.find(c => c.constraint_name.includes('barkod'))) {
            try {
                await pgService.query(`ALTER TABLE urun_barkodlari ADD CONSTRAINT unique_barkod_val UNIQUE (barkod)`);
                console.log('✓ urun_barkodlari(barkod) için UNIQUE eklendi');
            } catch (e) { console.log('Hata (barkod):', e.message); }
        }

        // urun_fiyat_listeleri için UNIQUE (stok_id, fiyat_tanimi_id) olmalı
        if (!f_res.find(c => c.constraint_name.includes('stok_id'))) {
            try {
                await pgService.query(`ALTER TABLE urun_fiyat_listeleri ADD CONSTRAINT unique_stok_fiyat_tanimi UNIQUE (stok_id, fiyat_tanimi_id)`);
                console.log('✓ urun_fiyat_listeleri(stok_id, fiyat_tanimi_id) için UNIQUE eklendi');
            } catch (e) { console.log('Hata (fiyat):', e.message); }
        }

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        await pgService.disconnect();
    }
}

checkMoreIndexes();
