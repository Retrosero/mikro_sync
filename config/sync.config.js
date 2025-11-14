require('dotenv').config();

module.exports = {
  syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '2000'),
  batchSize: parseInt(process.env.BATCH_SIZE || '50'),
  maxRetryCount: parseInt(process.env.MAX_RETRY_COUNT || '3'),
  
  // Senkronizasyon yönleri
  syncDirections: {
    // Web → ERP
    WEB_TO_ERP: [
      'satislar',
      'satis_kalemleri',
      'tahsilatlar',
      'cari_hesaplar',
      'alislar',
      'alis_kalemleri',
      'giderler'
    ],
    
    // ERP → Web
    ERP_TO_WEB: [
      'STOKLAR',
      'STOK_SATIS_FIYAT_LISTELERI',
      'BARKOD_TANIMLARI',
      'CARI_HESAPLAR',
      'CARI_HESAP_HAREKETLERI'
    ]
  },
  
  // Öncelik sırası (1 = en yüksek)
  priorities: {
    'satislar': 1,
    'tahsilatlar': 1,
    'STOKLAR': 2,
    'cari_hesaplar': 2,
    'BARKOD_TANIMLARI': 3,
    'STOK_SATIS_FIYAT_LISTELERI': 3
  }
};
