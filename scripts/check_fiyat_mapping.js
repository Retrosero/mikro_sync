const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const fiyatProcessor = require('../sync-jobs/fiyat.processor');

async function testFiyatSync() {
    try {
        console.log('Fiyat listesi tanımları kontrol ediliyor...\n');

        // ERP'deki fiyat listelerini göster
        const erpFiyatListeleri = await mssqlService.query(`
      SELECT TOP 5 sfl_sirano, sfl_isim 
      FROM STOK_SATIS_FIYAT_LISTE_TANIMLARI
      ORDER BY sfl_sirano
    `);

        console.log('ERP Fiyat Listeleri:');
        erpFiyatListeleri.forEach(fl => {
            console.log(`  ${fl.sfl_sirano}: ${fl.sfl_isim}`);
        });

        // Web'deki fiyat tanımlarını göster
        const webFiyatTanimlari = await pgService.query(`
      SELECT id, tanim_adi, varsayilan 
      FROM fiyat_tanimlari
      ORDER BY tanim_adi
      LIMIT 5
    `);

        console.log('\nWeb Fiyat Tanımları:');
        webFiyatTanimlari.forEach(ft => {
            console.log(`  ${ft.id}: ${ft.tanim_adi} (Varsayılan: ${ft.varsayilan})`);
        });

        // Mevcut mapping'leri göster
        const mappings = await pgService.query(`
      SELECT web_fiyat_tanimi_id, erp_liste_no, aciklama
      FROM int_kodmap_fiyat_liste
    `);

        console.log('\nMevcut Fiyat Mapping\'leri:');
        if (mappings.length === 0) {
            console.log('  Henüz mapping yok!');
            console.log('\n  Örnek mapping oluşturmak için:');
            console.log('  INSERT INTO int_kodmap_fiyat_liste (web_fiyat_tanimi_id, erp_liste_no, aciklama)');
            console.log('  VALUES (\'<web_fiyat_tanimi_id>\', <erp_liste_no>, \'Açıklama\');');
        } else {
            mappings.forEach(m => {
                console.log(`  Web: ${m.web_fiyat_tanimi_id} <-> ERP: ${m.erp_liste_no} (${m.aciklama || 'N/A'})`);
            });
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

testFiyatSync();
