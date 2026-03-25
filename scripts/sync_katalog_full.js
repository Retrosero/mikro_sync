const mssqlService = require('../services/mssql.service');
const pgService = require('../services/postgresql.service');
const logger = require('../utils/logger');

async function syncAllKatalogIsimleriBulk() {
  try {
    logger.info('ERP\'den sto_yabanci_isim verileri çekiliyor...');
    
    // MSSQL'den stok kodu ve yabancı isimleri çek
    const erpRecords = await mssqlService.query(`
      SELECT sto_kod, sto_yabanci_isim 
      FROM STOKLAR 
      WHERE sto_yabanci_isim IS NOT NULL AND sto_yabanci_isim <> ''
    `);

    logger.info(`ERP'de yabancı ismi olan ${erpRecords.length} kayıt bulundu.`);
    logger.info(`Bulk senkronizasyon başlıyor (batch: 500)...`);

    // Kayıtları temizle ve batch'lere ayır
    const validRecords = erpRecords
      .map(r => ({
        stok_kodu: (r.sto_kod || '').trim(),
        katalog_ismi: (r.sto_yabanci_isim || '').trim()
      }))
      .filter(r => r.stok_kodu !== '');

    const batchSize = 500;
    let totalUpdated = 0;

    for (let i = 0; i < validRecords.length; i += batchSize) {
      const batch = validRecords.slice(i, i + batchSize);
      const stok_kodlari = batch.map(r => r.stok_kodu);
      const katalog_isimleri = batch.map(r => r.katalog_ismi);

      try {
        // PostgreSQL toplu güncelleme (Bulk Update)
        const query = `
          UPDATE stoklar AS s
          SET 
            katalog_ismi = u.k_ismi,
            guncelleme_tarihi = NOW()
          FROM (
            SELECT unnest($1::text[]) as s_kod, unnest($2::text[]) as k_ismi
          ) AS u
          WHERE s.stok_kodu = u.s_kod
          RETURNING s.id
        `;

        const result = await pgService.query(query, [stok_kodlari, katalog_isimleri]);
        
        if (result && result.length > 0) {
          totalUpdated += result.length;
        }

        logger.info(`  İlerleme: ${Math.min(i + batchSize, validRecords.length)}/${validRecords.length} - ${totalUpdated} kayıt güncellendi.`);
      } catch (error) {
        logger.error(`Batch hatası (${i}-${i + batchSize}):`, error.message);
      }
    }

    logger.info(`İşlem başarıyla tamamlandı! Toplam güncellenen: ${totalUpdated}`);
    
  } catch (error) {
    logger.error('Kritik Hata:', error);
  } finally {
    process.exit(0);
  }
}

syncAllKatalogIsimleriBulk();
