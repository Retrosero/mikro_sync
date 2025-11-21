require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function runFullBulkSync() {
  try {
    console.log('='.repeat(70));
    console.log('TAM BULK SENKRONIZASYON (ERP → Web)');
    console.log('='.repeat(70));
    console.log();

    // Sync state'i temizle (tam senkronizasyon için)
    console.log('Sync state temizleniyor (tam senkronizasyon için)...');
    await pgService.query(`
      DELETE FROM sync_state 
      WHERE tablo_adi IN (
        'STOKLAR', 
        'BARKOD_TANIMLARI', 
        'STOK_SATIS_FIYAT_LISTELERI',
        'CARI_HESAPLAR',
        'CARI_HESAP_HAREKETLERI',
        'STOK_HAREKETLERI'
      )
      AND yon = 'erp_to_web'
    `);
    console.log('✓ Sync state temizlendi');
    console.log();

    // Başlangıç durumu
    console.log('BAŞLANGIÇ DURUMU:');
    console.log('-'.repeat(70));
    
    const erpStokCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM STOKLAR WHERE sto_pasif_fl = 0'
    );
    console.log(`ERP Aktif Stok: ${erpStokCount[0].count}`);

    const erpBarkodCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM BARKOD_TANIMLARI'
    );
    console.log(`ERP Barkod: ${erpBarkodCount[0].count}`);

    const erpFiyatCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM STOK_SATIS_FIYAT_LISTELERI WHERE sfiyat_fiyati > 0'
    );
    console.log(`ERP Fiyat: ${erpFiyatCount[0].count}`);

    const erpCariCount = await mssqlService.query(
      'SELECT COUNT(*) as count FROM CARI_HESAPLAR'
    );
    console.log(`ERP Cari: ${erpCariCount[0].count}`);

    const webStokCountBefore = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
    console.log(`Web Stok: ${webStokCountBefore[0].count}`);

    const webBarkodCountBefore = await pgService.query('SELECT COUNT(*) as count FROM urun_barkodlari');
    console.log(`Web Barkod: ${webBarkodCountBefore[0].count}`);

    const webFiyatCountBefore = await pgService.query('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
    console.log(`Web Fiyat: ${webFiyatCountBefore[0].count}`);

    const webCariCountBefore = await pgService.query('SELECT COUNT(*) as count FROM cari_hesaplar');
    console.log(`Web Cari: ${webCariCountBefore[0].count}`);

    console.log();
    console.log('='.repeat(70));
    console.log();

    // Bulk sync'i çalıştır
    console.log('Bulk senkronizasyon başlatılıyor...');
    console.log();

    const startTime = Date.now();

    // Child process olarak çalıştır
    const { spawn } = require('child_process');
    const bulkProcess = spawn('node', ['scripts/fast_bulk_sync.js'], {
      stdio: 'inherit'
    });

    await new Promise((resolve, reject) => {
      bulkProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Bulk sync failed with code ${code}`));
        }
      });
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log();
    console.log('='.repeat(70));
    console.log();

    // Son durum
    console.log('SON DURUM:');
    console.log('-'.repeat(70));

    const webStokCountAfter = await pgService.query('SELECT COUNT(*) as count FROM stoklar');
    const stokDiff = webStokCountAfter[0].count - webStokCountBefore[0].count;
    console.log(`Web Stok: ${webStokCountBefore[0].count} → ${webStokCountAfter[0].count} (${stokDiff >= 0 ? '+' : ''}${stokDiff})`);

    const webBarkodCountAfter = await pgService.query('SELECT COUNT(*) as count FROM urun_barkodlari');
    const barkodDiff = webBarkodCountAfter[0].count - webBarkodCountBefore[0].count;
    console.log(`Web Barkod: ${webBarkodCountBefore[0].count} → ${webBarkodCountAfter[0].count} (${barkodDiff >= 0 ? '+' : ''}${barkodDiff})`);

    const webFiyatCountAfter = await pgService.query('SELECT COUNT(*) as count FROM urun_fiyat_listeleri');
    const fiyatDiff = webFiyatCountAfter[0].count - webFiyatCountBefore[0].count;
    console.log(`Web Fiyat: ${webFiyatCountBefore[0].count} → ${webFiyatCountAfter[0].count} (${fiyatDiff >= 0 ? '+' : ''}${fiyatDiff})`);

    const webCariCountAfter = await pgService.query('SELECT COUNT(*) as count FROM cari_hesaplar');
    const cariDiff = webCariCountAfter[0].count - webCariCountBefore[0].count;
    console.log(`Web Cari: ${webCariCountBefore[0].count} → ${webCariCountAfter[0].count} (${cariDiff >= 0 ? '+' : ''}${cariDiff})`);

    console.log();
    console.log(`Toplam Süre: ${duration} saniye`);

    console.log();
    console.log('='.repeat(70));
    console.log('✓ TAM BULK SENKRONIZASYON TAMAMLANDI!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error();
    console.error('='.repeat(70));
    console.error('✗ SENKRONIZASYON BAŞARISIZ!');
    console.error('='.repeat(70));
    console.error('Hata:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pgService.disconnect();
    await mssqlService.disconnect();
    process.exit(0);
  }
}

runFullBulkSync();
