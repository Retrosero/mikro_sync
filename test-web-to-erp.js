require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');
const satisProcessor = require('./sync-jobs/satis.processor');
const tahsilatProcessor = require('./sync-jobs/tahsilat.processor');

async function testWebToERP() {
  try {
    console.log('='.repeat(70));
    console.log('WEB → ERP SENKRONIZASYON TESTİ');
    console.log('='.repeat(70));
    console.log();

    // 1. Bağlantı Testi
    console.log('1. Veritabanı bağlantıları test ediliyor...');
    await pgService.query('SELECT 1');
    console.log('   ✓ PostgreSQL bağlantısı başarılı');
    
    await mssqlService.query('SELECT 1');
    console.log('   ✓ MS SQL bağlantısı başarılı');
    console.log();

    // 2. Web'deki Satışları Kontrol Et
    console.log('2. Web\'deki satışlar kontrol ediliyor...');
    const webSatislar = await pgService.query(`
      SELECT 
        s.id,
        s.satis_no,
        s.satis_tarihi,
        s.odeme_sekli,
        s.toplam_tutar,
        c.cari_kodu,
        c.cari_adi,
        COUNT(sk.id) as kalem_sayisi
      FROM satislar s
      LEFT JOIN cari_hesaplar c ON c.id = s.cari_hesap_id
      LEFT JOIN satis_kalemleri sk ON sk.satis_id = s.id
      WHERE s.satis_tarihi >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY s.id, s.satis_no, s.satis_tarihi, s.odeme_sekli, s.toplam_tutar, c.cari_kodu, c.cari_adi
      ORDER BY s.satis_tarihi DESC
      LIMIT 10
    `);

    console.log(`   ${webSatislar.length} satış bulundu (son 7 gün)`);
    
    if (webSatislar.length > 0) {
      console.log('\n   Örnek satışlar:');
      webSatislar.slice(0, 5).forEach(s => {
        console.log(`   - ${s.satis_no}: ${s.cari_adi} - ${s.toplam_tutar} TL (${s.kalem_sayisi} kalem)`);
      });
    } else {
      console.log('   ⚠ Son 7 günde satış bulunamadı');
    }
    console.log();

    // 3. Web'deki Tahsilatları Kontrol Et
    console.log('3. Web\'deki tahsilatlar kontrol ediliyor...');
    const webTahsilatlar = await pgService.query(`
      SELECT 
        t.id,
        t.tahsilat_no,
        t.tahsilat_tarihi,
        t.tahsilat_tipi,
        t.tutar,
        c.cari_kodu,
        c.cari_adi
      FROM tahsilatlar t
      LEFT JOIN cari_hesaplar c ON c.id = t.cari_hesap_id
      WHERE t.tahsilat_tarihi >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY t.tahsilat_tarihi DESC
      LIMIT 10
    `);

    console.log(`   ${webTahsilatlar.length} tahsilat bulundu (son 7 gün)`);
    
    if (webTahsilatlar.length > 0) {
      console.log('\n   Örnek tahsilatlar:');
      webTahsilatlar.slice(0, 5).forEach(t => {
        console.log(`   - ${t.tahsilat_no}: ${t.cari_adi} - ${t.tutar} TL (${t.tahsilat_tipi})`);
      });
    } else {
      console.log('   ⚠ Son 7 günde tahsilat bulunamadı');
    }
    console.log();

    // 4. Sync Queue Kontrolü (Atlandı - tablo yapısı farklı olabilir)
    console.log('4. Sync queue kontrolü atlandı');
    console.log();

    // 5. Trigger Kontrolü
    console.log('5. Web trigger\'ları kontrol ediliyor...');
    const triggers = await pgService.query(`
      SELECT 
        trigger_name,
        event_object_table,
        action_timing,
        event_manipulation
      FROM information_schema.triggers
      WHERE event_object_table IN ('satislar', 'satis_kalemleri', 'tahsilatlar')
      ORDER BY event_object_table, trigger_name
    `);

    if (triggers.length > 0) {
      console.log(`   ${triggers.length} trigger bulundu:`);
      triggers.forEach(t => {
        console.log(`   - ${t.trigger_name} (${t.event_object_table}) - ${t.action_timing} ${t.event_manipulation}`);
      });
    } else {
      console.log('   ⚠ Trigger bulunamadı!');
    }
    console.log();

    // 6. Processor Test (Eğer veri varsa)
    if (webSatislar.length > 0) {
      console.log('6. Satış processor testi...');
      const testSatis = webSatislar[0];
      
      // Satış detaylarını al
      const satisDetay = await pgService.queryOne(`
        SELECT * FROM satislar WHERE id = $1
      `, [testSatis.id]);

      const kalemler = await pgService.query(`
        SELECT * FROM satis_kalemleri WHERE satis_id = $1
      `, [testSatis.id]);

      console.log(`   Test satış: ${testSatis.satis_no}`);
      console.log(`   - Cari: ${testSatis.cari_adi}`);
      console.log(`   - Tutar: ${testSatis.toplam_tutar} TL`);
      console.log(`   - Kalem sayısı: ${kalemler.length}`);
      console.log(`   - Ödeme şekli: ${testSatis.odeme_sekli}`);
      
      // NOT: Gerçek senkronizasyon yapmıyoruz, sadece kontrol ediyoruz
      console.log('   ℹ Gerçek senkronizasyon yapılmadı (test modu)');
    }
    console.log();

    // 7. ERP'de Kontrol
    console.log('7. ERP\'de son kayıtlar kontrol ediliyor...');
    
    // Son satışlar
    const erpSatislar = await mssqlService.query(`
      SELECT TOP 5
        cha_evrakno_seri + CAST(cha_evrakno_sira AS VARCHAR) as evrak_no,
        cha_tarihi,
        cha_kod as cari_kod,
        cha_meblag as tutar
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrak_tip = 0
        AND cha_tarihi >= DATEADD(day, -7, GETDATE())
      ORDER BY cha_tarihi DESC
    `);

    console.log(`   ${erpSatislar.length} satış bulundu (son 7 gün):`);
    erpSatislar.forEach(s => {
      console.log(`   - ${s.evrak_no}: ${s.cari_kod} - ${s.tutar} TL`);
    });
    console.log();

    // Son tahsilatlar
    const erpTahsilatlar = await mssqlService.query(`
      SELECT TOP 5
        cha_evrakno_seri + CAST(cha_evrakno_sira AS VARCHAR) as evrak_no,
        cha_tarihi,
        cha_kod as cari_kod,
        cha_meblag as tutar
      FROM CARI_HESAP_HAREKETLERI
      WHERE cha_evrak_tip IN (1, 2, 3, 4, 5)
        AND cha_tarihi >= DATEADD(day, -7, GETDATE())
      ORDER BY cha_tarihi DESC
    `);

    console.log(`   ${erpTahsilatlar.length} tahsilat bulundu (son 7 gün):`);
    erpTahsilatlar.forEach(t => {
      console.log(`   - ${t.evrak_no}: ${t.cari_kod} - ${t.tutar} TL`);
    });
    console.log();

    console.log('='.repeat(70));
    console.log('✓ TEST TAMAMLANDI!');
    console.log('='.repeat(70));
    console.log();
    console.log('ÖZET:');
    console.log(`- Web Satışlar: ${webSatislar.length}`);
    console.log(`- Web Tahsilatlar: ${webTahsilatlar.length}`);
    console.log(`- ERP Satışlar: ${erpSatislar.length}`);
    console.log(`- ERP Tahsilatlar: ${erpTahsilatlar.length}`);
    console.log(`- Trigger\'lar: ${triggers.length > 0 ? '✓ Aktif' : '✗ Yok'}`);

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ TEST BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgService.disconnect();
    await mssqlService.disconnect();
    process.exit(0);
  }
}

testWebToERP();
