# Proje Yapısı ve Mimari

## Klasör Yapısı

```
erp-web-sync/
├── config/                          # Konfigürasyon dosyaları
│   ├── mssql.config.js             # MS SQL bağlantı ayarları
│   ├── postgresql.config.js        # PostgreSQL bağlantı ayarları
│   └── sync.config.js              # Senkronizasyon kuralları
│
├── mappings/                        # Veri eşleştirme modülleri
│   └── lookup-tables.js            # Mapping cache ve yönetimi
│
├── services/                        # Veritabanı servisleri
│   ├── mssql.service.js            # MS SQL işlemleri
│   ├── postgresql.service.js      # PostgreSQL işlemleri
│   └── sync.service.js             # Ana senkronizasyon mantığı
│
├── transformers/                    # Veri dönüştürücüler
│   ├── satis.transformer.js        # Satış veri dönüşümleri
│   ├── stok.transformer.js         # Stok veri dönüşümleri
│   └── tahsilat.transformer.js     # Tahsilat veri dönüşümleri
│
├── sync-jobs/                       # İşlem processor'ları
│   ├── satis.processor.js          # Satış senkronizasyonu
│   ├── stok.processor.js           # Stok senkronizasyonu
│   ├── fiyat.processor.js          # Fiyat senkronizasyonu
│   └── tahsilat.processor.js       # Tahsilat senkronizasyonu
│
├── scripts/                         # Yardımcı scriptler
│   ├── sql/
│   │   ├── postgresql-setup.sql    # PostgreSQL trigger'lar
│   │   └── mssql-setup.sql         # MS SQL trigger'lar
│   ├── setup-database.js           # Veritabanı kurulum scripti
│   ├── test-connection.js          # Bağlantı test scripti
│   └── sample-mappings.sql         # Örnek mapping verileri
│
├── utils/                           # Yardımcı araçlar
│   ├── logger.js                   # Loglama sistemi
│   └── error-handler.js            # Hata yönetimi
│
├── logs/                            # Log dosyaları (otomatik oluşur)
│   ├── combined.log                # Tüm loglar
│   └── error.log                   # Sadece hatalar
│
├── .env                             # Ortam değişkenleri (oluşturulacak)
├── .env.example                     # Örnek ortam değişkenleri
├── .gitignore                       # Git ignore kuralları
├── index.js                         # Ana uygulama
├── package.json                     # NPM bağımlılıkları
├── README.md                        # Genel bilgi
├── KURULUM.md                       # Detaylı kurulum kılavuzu
├── HIZLI-BASLANGIC.md              # Hızlı başlangıç kılavuzu
└── PROJE-YAPISI.md                 # Bu dosya
```

## Veri Akışı

### Web → ERP (Satış Örneği)

```
1. Web Uygulaması
   └─> satislar tablosuna INSERT
       └─> PostgreSQL Trigger tetiklenir
           └─> sync_queue tablosuna kayıt eklenir
               └─> Sync Service queue'dan okur
                   └─> satis.processor.js çalışır
                       └─> satis.transformer.js veriyi dönüştürür
                           └─> lookup-tables.js mapping'leri bulur
                               └─> mssql.service.js ERP'ye yazar
                                   ├─> CARI_HESAP_HAREKETLERI (başlık)
                                   └─> STOK_HAREKETLERI (satırlar)
```

### ERP → Web (Stok Örneği)

```
1. ERP Programı
   └─> STOKLAR tablosunda UPDATE
       └─> MS SQL Trigger tetiklenir
           └─> SYNC_QUEUE tablosuna kayıt eklenir
               └─> Sync Service queue'dan okur
                   └─> stok.processor.js çalışır
                       └─> stok.transformer.js veriyi dönüştürür
                           └─> lookup-tables.js mapping'leri bulur/oluşturur
                               └─> postgresql.service.js Web'e yazar
                                   ├─> stoklar (ana kayıt)
                                   └─> barkod_tanimlari (barkodlar)
```

## Modül Açıklamaları

### 1. Config Modülleri

**mssql.config.js**
- MS SQL Server bağlantı parametreleri
- Connection pool ayarları
- Timeout değerleri

**postgresql.config.js**
- PostgreSQL bağlantı parametreleri
- Connection pool ayarları
- SSL ayarları

**sync.config.js**
- Senkronizasyon interval'i
- Batch size
- Retry sayısı
- Öncelik sıralaması

### 2. Service Modülleri

**mssql.service.js**
- MS SQL bağlantı yönetimi
- Query çalıştırma
- Stored procedure çağırma
- Transaction yönetimi
- SESSION_CONTEXT ayarlama

**postgresql.service.js**
- PostgreSQL bağlantı yönetimi
- Query çalıştırma
- Transaction yönetimi
- Connection pooling

**sync.service.js**
- Ana senkronizasyon döngüsü
- Queue işleme
- Processor yönetimi
- Retry mekanizması
- Log kaydetme

### 3. Transformer Modülleri

**satis.transformer.js**
- Web satış → ERP CARI_HESAP_HAREKETLERI
- Web satış kalem → ERP STOK_HAREKETLERI
- Ödeme şekli mapping
- KDV hesaplamaları

**tahsilat.transformer.js**
- Web tahsilat → ERP CARI_HESAP_HAREKETLERI
- Çek/Senet → ERP ODEME_EMIRLERI
- Tahsilat tipi mapping
- Çek açıklama formatı

**stok.transformer.js**
- ERP STOKLAR → Web stoklar
- ERP BARKOD_TANIMLARI → Web barkod_tanimlari
- ERP STOK_SATIS_FIYAT_LISTELERI → Web urun_fiyat_listeleri

### 4. Processor Modülleri

**satis.processor.js**
- Satış başlık ve satırları işler
- Transaction içinde yazar
- Veresiye/peşin kontrolü
- Hata yönetimi

**tahsilat.processor.js**
- Tahsilat kayıtlarını işler
- Çek/senet için ödeme emri oluşturur
- Kasa/banka mapping

**stok.processor.js**
- Stok kartlarını işler
- Barkodları senkronize eder
- Mapping oluşturur/günceller

**fiyat.processor.js**
- Fiyat listelerini işler
- Stok ve fiyat liste mapping kontrolü
- Tarih aralığı yönetimi

### 5. Mapping Sistemi

**lookup-tables.js**
- Tüm mapping'leri cache'ler
- 5 dakikalık cache süresi
- Otomatik yenileme
- CRUD işlemleri

**Mapping Tabloları:**
- `int_kodmap_cari` - Cari hesap eşleştirmeleri
- `int_kodmap_stok` - Stok eşleştirmeleri
- `int_kodmap_banka` - Banka eşleştirmeleri
- `int_kodmap_kasa` - Kasa eşleştirmeleri
- `int_kodmap_fiyat_liste` - Fiyat liste eşleştirmeleri
- `INT_KdvPointerMap` - KDV oran → pointer

## Trigger Sistemi

### PostgreSQL Trigger'ları

Her tablo için ayrı trigger:
- `trg_satislar_sync` - Satışlar
- `trg_satis_kalemleri_sync` - Satış kalemleri
- `trg_tahsilatlar_sync` - Tahsilatlar
- `trg_alislar_sync` - Alışlar
- `trg_alis_kalemleri_sync` - Alış kalemleri
- `trg_giderler_sync` - Giderler
- `trg_cari_hesaplar_sync` - Cari hesaplar

**Çalışma Prensibi:**
```sql
CREATE TRIGGER trg_satislar_sync
AFTER INSERT OR UPDATE ON satislar
FOR EACH ROW
EXECUTE FUNCTION trigger_satislar_sync();
```

### MS SQL Trigger'ları

Her tablo için ayrı trigger:
- `trg_STOKLAR_sync` - Stoklar
- `trg_BARKOD_TANIMLARI_sync` - Barkodlar
- `trg_STOK_SATIS_FIYAT_LISTELERI_sync` - Fiyat listeleri
- `trg_CARI_HESAPLAR_sync` - Cari hesaplar

**SESSION_CONTEXT Kontrolü:**
```sql
IF SESSION_CONTEXT(N'SYNC_ORIGIN') = 'WEB'
  RETURN;  -- Döngüyü önle
```

## Queue Sistemi

### Queue Tablosu Yapısı

```sql
sync_queue (
  id UUID PRIMARY KEY,
  source_table TEXT,           -- Kaynak tablo
  operation TEXT,              -- INSERT, UPDATE, DELETE
  record_id TEXT,              -- Kayıt ID
  record_data JSONB,           -- Kayıt verisi
  priority INTEGER,            -- Öncelik (1=en yüksek)
  status TEXT,                 -- pending, processing, completed, failed
  retry_count INTEGER,         -- Deneme sayısı
  error_message TEXT,          -- Hata mesajı
  created_at TIMESTAMP,        -- Oluşturma zamanı
  processed_at TIMESTAMP       -- İşlenme zamanı
)
```

### Queue İşleme Akışı

1. Trigger → Queue'ya kayıt ekler
2. Sync Service → Queue'dan okur (batch)
3. Status → 'processing' olarak işaretler
4. Processor → İşlemi yapar
5. Başarılı → Status 'completed'
6. Hatalı → Retry veya 'failed'

## Hata Yönetimi

### Retry Mekanizması

```javascript
if (isRetryable(error) && item.retry_count < maxRetryCount) {
  // Tekrar dene
  updateQueueStatus(item.id, 'pending', retry_count + 1);
} else {
  // Başarısız olarak işaretle
  updateQueueStatus(item.id, 'failed', error_message);
}
```

### Retryable Hatalar

- ECONNRESET - Bağlantı kesildi
- ETIMEDOUT - Zaman aşımı
- ENOTFOUND - Sunucu bulunamadı
- ECONNREFUSED - Bağlantı reddedildi
- DEADLOCK - Veritabanı kilidi
- LOCK_TIMEOUT - Kilit zaman aşımı

## Loglama

### Log Seviyeleri

- `error` - Hatalar
- `warn` - Uyarılar
- `info` - Bilgi mesajları
- `debug` - Debug mesajları

### Log Dosyaları

- `logs/combined.log` - Tüm loglar
- `logs/error.log` - Sadece hatalar

### Veritabanı Logları

```sql
sync_logs (
  id UUID,
  direction TEXT,              -- WEB_TO_ERP, ERP_TO_WEB
  entity TEXT,                 -- Tablo adı
  operation TEXT,              -- INSERT, UPDATE
  record_id TEXT,              -- Kayıt ID
  status TEXT,                 -- SUCCESS, FAILED
  error_message TEXT,          -- Hata mesajı
  duration_ms INTEGER,         -- İşlem süresi (ms)
  created_at TIMESTAMP
)
```

## Performans Optimizasyonları

### 1. Connection Pooling
- PostgreSQL: Max 10 connection
- MS SQL: Max 10 connection

### 2. Batch Processing
- Varsayılan: 50 kayıt/batch
- Ayarlanabilir: BATCH_SIZE

### 3. Cache Sistemi
- Lookup mapping'ler cache'lenir
- 5 dakikalık cache süresi
- Otomatik yenileme

### 4. Index'ler
```sql
-- Queue performansı için
CREATE INDEX idx_sync_queue_status 
ON sync_queue(status, priority, created_at);

-- Log sorguları için
CREATE INDEX idx_sync_logs_date 
ON sync_logs(created_at);
```

### 5. Temizlik İşlemleri
```sql
-- 7 günden eski completed kayıtlar
DELETE FROM sync_queue 
WHERE status = 'completed' 
AND processed_at < NOW() - INTERVAL '7 days';

-- 30 günden eski loglar
DELETE FROM sync_logs 
WHERE created_at < NOW() - INTERVAL '30 days';
```

## Güvenlik

### 1. Veritabanı Yetkileri
- Minimum gerekli yetkiler
- Sadece gerekli tablolara erişim

### 2. Bağlantı Güvenliği
- SSL/TLS desteği
- Şifreli bağlantılar (production)

### 3. SESSION_CONTEXT
- Trigger döngülerini önler
- Senkronizasyon kaynağını belirtir

### 4. Transaction Yönetimi
- Atomik işlemler
- Rollback desteği
- Veri bütünlüğü

## Monitoring ve Bakım

### Günlük Kontroller
```sql
-- Queue durumu
SELECT status, COUNT(*) FROM sync_queue GROUP BY status;

-- Son hatalar
SELECT * FROM sync_logs WHERE status = 'FAILED' 
ORDER BY created_at DESC LIMIT 10;

-- Başarı oranı
SELECT 
  status,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM sync_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

### Haftalık Bakım
- Log dosyalarını temizle
- Eski queue kayıtlarını sil
- Mapping'leri kontrol et
- Performans metriklerini incele

### Aylık Bakım
- Index'leri yeniden oluştur
- Veritabanı istatistiklerini güncelle
- Backup kontrolü
- Güvenlik güncellemeleri
