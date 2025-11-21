const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');

async function setupPriceMappings() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  💰 FİYAT LİSTESİ EŞLEŞTİRME ARACI');
    console.log('═══════════════════════════════════════════════════════\n');

    try {
        // 1. Web'deki Fiyat Tanımlarını Getir
        const webFiyatTanimlari = await pgService.query('SELECT id, tanim_adi, para_birimi FROM fiyat_tanimlari ORDER BY tanim_adi');

        if (webFiyatTanimlari.length === 0) {
            console.log('❌ Web tarafında hiç fiyat tanımı bulunamadı!');
            return;
        }

        console.log('📋 Web Fiyat Tanımları:');
        webFiyatTanimlari.forEach((tanim, index) => {
            console.log(`   [${index + 1}] ${tanim.tanim_adi} (${tanim.para_birimi}) - ID: ${tanim.id}`);
        });

        // 2. ERP'deki Fiyat Listelerini Analiz Et (Distinct Liste No)
        console.log('\n🔍 ERP Fiyat Listeleri Analiz Ediliyor...');
        const erpListeler = await mssqlService.query(`
      SELECT DISTINCT sfiyat_listesirano 
      FROM STOK_SATIS_FIYAT_LISTELERI 
      ORDER BY sfiyat_listesirano
    `);

        console.log('📋 ERP Fiyat Liste Numaraları:');
        erpListeler.forEach(l => {
            console.log(`   - Liste No: ${l.sfiyat_listesirano}`);
        });

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('💡 OTOMATİK EŞLEŞTİRME ÖNERİSİ');
        console.log('═══════════════════════════════════════════════════════');

        // Varsayılan bir mapping oluştur (Örnek)
        // Kullanıcı bu kısmı kendi ihtiyacına göre düzenleyebilir
        const mappings = [];

        // ÖRNEK MANTIK: 
        // ERP Liste 1 -> Web'deki ilk fiyat tanımı (Genelde Satış Fiyatı)
        // ERP Liste 2 -> Web'deki ikinci fiyat tanımı

        if (webFiyatTanimlari.length > 0) {
            mappings.push({
                erp_no: 1,
                web_id: webFiyatTanimlari[0].id,
                desc: 'Varsayılan Satış Fiyatı'
            });
        }

        if (webFiyatTanimlari.length > 1) {
            mappings.push({
                erp_no: 2,
                web_id: webFiyatTanimlari[1].id,
                desc: 'İkinci Fiyat'
            });
        }

        console.log('\nUygulanacak Eşleştirmeler:');
        mappings.forEach(m => {
            const webTanim = webFiyatTanimlari.find(w => w.id === m.web_id);
            console.log(`   ERP Liste ${m.erp_no}  ➡️  Web: ${webTanim.tanim_adi}`);
        });

        // Mappingleri Kaydet
        console.log('\n💾 Eşleştirmeler kaydediliyor...');

        // Önce temizle
        await pgService.query('DELETE FROM int_kodmap_fiyat_liste');

        for (const m of mappings) {
            await pgService.query(`
        INSERT INTO int_kodmap_fiyat_liste (web_fiyat_tanimi_id, erp_liste_no, aciklama)
        VALUES ($1, $2, $3)
      `, [m.web_id, m.erp_no, m.desc]);
        }

        console.log('✅ Eşleştirmeler başarıyla kaydedildi!');
        console.log('👉 Artık `node scripts/fast_bulk_sync.js` komutunu çalıştırabilirsiniz.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

setupPriceMappings();
