require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function createDemoSale() {
  try {
    console.log('SERHAN Müşterisine Demo Satış Oluşturuluyor...');
    console.log('='.repeat(70));

    // 1. SERHAN cari kodunu bul
    const cariResult = await pgService.query(`
      SELECT id, cari_kodu, cari_adi 
      FROM cari_hesaplar 
      WHERE cari_kodu = 'SERHAN'
      LIMIT 1
    `);

    if (cariResult.length === 0) {
      throw new Error('SERHAN müşterisi bulunamadı!');
    }

    const cari = cariResult[0];
    console.log(`✓ Cari bulundu: ${cari.cari_adi} (${cari.cari_kodu})`);

    // 2. Bir stok bul
    const stokResult = await pgService.query(`
      SELECT id, stok_kodu, stok_adi, satis_fiyati
      FROM stoklar
      WHERE aktif = true
      LIMIT 1
    `);

    if (stokResult.length === 0) {
      throw new Error('Aktif stok bulunamadı!');
    }

    const stok = stokResult[0];
    console.log(`✓ Stok bulundu: ${stok.stok_adi} (${stok.stok_kodu})`);

    // 3. Demo satış oluştur
    const miktar = 2;
    const birimFiyat = parseFloat(stok.satis_fiyati) || 100;
    const toplamTutar = miktar * birimFiyat;

    const satisResult = await pgService.query(`
      INSERT INTO satislar (
        satis_tarihi, cari_hesap_id, toplam_tutar, kaynak
      ) VALUES (
        CURRENT_DATE, $1, $2, 'web'
      ) RETURNING id
    `, [cari.id, toplamTutar]);

    const satisId = satisResult[0].id;
    console.log(`✓ Satış başlığı oluşturuldu (ID: ${satisId})`);

    // 4. Satış kalemi ekle
    await pgService.query(`
      INSERT INTO satis_kalemleri (
        satis_id, stok_id, miktar, birim_fiyat, toplam_tutar, sira_no
      ) VALUES (
        $1, $2, $3, $4, $5, 1
      )
    `, [satisId, stok.id, miktar, birimFiyat, toplamTutar]);

    console.log(`✓ Satış kalemi eklendi (${miktar} x ${stok.stok_adi})`);

    // 5. Sync queue'yu kontrol et
    console.log('\n' + '-'.repeat(70));
    console.log('Sync Queue Kontrolü:');

    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 saniye bekle

    const queueCheck = await pgService.query(`
      SELECT * FROM sync_queue 
      WHERE entity_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [satisId]);

    if (queueCheck.length > 0) {
      console.log('✓ Satış sync queue\'ya eklendi!');
      console.log(`  - Entity Type: ${queueCheck[0].entity_type}`);
      console.log(`  - Status: ${queueCheck[0].status}`);
      console.log(`  - Created: ${queueCheck[0].created_at}`);
    } else {
      console.log('⚠ Satış sync queue\'da bulunamadı.');
    }

    // 6. Özet
    console.log('\n' + '='.repeat(70));
    console.log('✓ DEMO SATIŞ BAŞARIYLA OLUŞTURULDU!');
    console.log('='.repeat(70));
    console.log(`Müşteri: ${cari.cari_adi} (${cari.cari_kodu})`);
    console.log(`Ürün: ${stok.stok_adi} (${stok.stok_kodu})`);
    console.log(`Miktar: ${miktar}`);
    console.log(`Birim Fiyat: ${birimFiyat.toFixed(2)} TL`);
    console.log(`Toplam: ${toplamTutar.toFixed(2)} TL`);
    console.log('='.repeat(70));
    console.log('\nWorker aktif ise bu satış otomatik olarak ERP\'ye gönderilecek!');

  } catch (error) {
    console.error('✗ Hata:', error.message);
    throw error;
  } finally {
    await pgService.disconnect();
  }
}

createDemoSale();
