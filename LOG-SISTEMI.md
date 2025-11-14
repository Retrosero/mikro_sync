# Gelişmiş Log Sistemi Dokümantasyonu

## 📊 Genel Bakış

Mikro Sync, detaylı hata tespiti ve performans takibi için gelişmiş bir log sistemi içerir.

## 🗂️ Log Dosyaları

### 1. combined.log
Tüm log seviyelerini içerir (info, warn, error)
- Maksimum boyut: 10MB
- Maksimum dosya sayısı: 10
- Otomatik rotation

### 2. error.log
Sadece hata loglarını içerir
- Detaylı stack trace
- Hata context bilgisi
- Maksimum boyut: 10MB
- Maksimum dosya sayısı: 10

### 3. sync.log
Sadece senkronizasyon işlemlerini içerir
- Başlangıç/bitiş zamanları
- İşlem süreleri
- Başarı/başarısızlık durumu
- Maksimum boyut: 10MB
- Maksimum dosya sayısı: 5

## 📝 Log Seviyeleri

### ERROR
Kritik hatalar ve başarısız işlemler
```javascript
logger.error('Kritik hata', {
  context: 'operation-name',
  error: error.message,
  stack: error.stack
});
```

### WARN
Uyarılar ve potansiyel sorunlar
```javascript
logger.warn('Performans uyarısı', {
  context: 'performance',
  duration: '5500ms'
});
```

### INFO
Genel bilgi mesajları
```javascript
logger.info('İşlem başarılı', {
  context: 'sync-success',
  recordId: 'uuid-123'
});
```

## 🎯 Özel Log Fonksiyonları

### syncStart()
Senkronizasyon başlangıcı
```javascript
logger.syncStart('satislar', 'uuid-123', 'INSERT');
```

**Çıktı:**
```
2025-11-14 10:30:00 [INFO] [sync-start]: Senkronizasyon başladı
  Meta: {
    "table": "satislar",
    "recordId": "uuid-123",
    "operation": "INSERT"
  }
```

### syncSuccess()
Başarılı senkronizasyon
```javascript
logger.syncSuccess('satislar', 'uuid-123', 'INSERT', 150);
```

**Çıktı:**
```
2025-11-14 10:30:00 [INFO] [sync-success]: Senkronizasyon başarılı
  Meta: {
    "table": "satislar",
    "recordId": "uuid-123",
    "operation": "INSERT",
    "duration": "150ms"
  }
```

### syncError()
Senkronizasyon hatası
```javascript
logger.syncError('satislar', 'uuid-123', 'INSERT', error, {
  direction: 'WEB_TO_ERP',
  retryCount: 1
});
```

**Çıktı:**
```
2025-11-14 10:30:00 [ERROR] [sync-error]: Senkronizasyon hatası
  Meta: {
    "table": "satislar",
    "recordId": "uuid-123",
    "operation": "INSERT",
    "error": "Connection timeout",
    "errorCode": "ETIMEDOUT",
    "direction": "WEB_TO_ERP",
    "retryCount": 1
  }
  Stack: Error: Connection timeout
    at MSSQLService.connect (mssql.service.js:15:10)
    ...
```

### dbConnection()
Veritabanı bağlantı durumu
```javascript
logger.dbConnection('PostgreSQL', 'success');
logger.dbConnection('MS SQL', 'failed', error);
```

### mappingError()
Mapping bulunamadı hatası
```javascript
logger.mappingError('cari', 'uuid-123', {
  availableMappings: 50
});
```

**Çıktı:**
```
2025-11-14 10:30:00 [ERROR] [mapping-error]: Mapping bulunamadı
  Meta: {
    "mappingType": "cari",
    "id": "uuid-123",
    "availableMappings": 50,
    "suggestion": "INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) VALUES (...)"
  }
```

### queueStatus()
Queue durum raporu
```javascript
logger.queueStatus(10, 2, 100, 5);
```

**Çıktı:**
```
2025-11-14 10:30:00 [INFO] [queue-status]: Queue durumu
  Meta: {
    "pending": 10,
    "processing": 2,
    "completed": 100,
    "failed": 5,
    "total": 117
  }
```

### performance()
Performans metrikleri
```javascript
logger.performance('sync-item', 5500, {
  table: 'satislar',
  recordId: 'uuid-123'
});
```

**Çıktı:**
```
2025-11-14 10:30:00 [WARN] [performance]: Performans metriği
  Meta: {
    "operation": "sync-item",
    "duration": "5500ms",
    "table": "satislar",
    "recordId": "uuid-123"
  }
```

## 🔍 Log Analizi

### Manuel Analiz

```bash
# Tüm logları görüntüle
cat logs/combined.log

# Sadece hataları görüntüle
cat logs/error.log

# Son 100 satırı izle
tail -f -n 100 logs/combined.log

# Hataları filtrele
grep "ERROR" logs/combined.log

# Belirli bir tabloyu ara
grep "satislar" logs/sync.log

# Mapping hatalarını bul
grep "mapping-error" logs/error.log
```

### Otomatik Analiz Aracı

```bash
# Tüm logları analiz et
npm run analyze-logs

# Belirli bir dosyayı analiz et
npm run analyze-logs error.log
npm run analyze-logs sync.log
```

**Örnek Çıktı:**
```
======================================================================
  Log Analizi: combined.log
======================================================================

📊 Genel İstatistikler:
  Toplam Log: 1250
  ✅ Info: 1100
  ⚠️  Warn: 50
  ❌ Error: 100

🔄 Senkronizasyon İstatistikleri:
  ✅ Başarılı: 950
  ❌ Başarısız: 50
  📈 Başarı Oranı: 95.00%

📋 Diğer İstatistikler:
  🗺️  Mapping Hataları: 25
  🔌 DB Bağlantı Logları: 10
  ⏱️  Performans Uyarıları: 15

❌ Son 10 Hata:
  1. 2025-11-14 10:30:00 [ERROR] [sync-error]: Senkronizasyon hatası...
  2. 2025-11-14 10:31:00 [ERROR] [mapping-error]: Mapping bulunamadı...
  ...

💡 Öneriler:
  • Mapping hatalarını düzeltmek için int_kodmap_* tablolarını kontrol edin
  ✅ Sistem sorunsuz çalışıyor!
```

## 🎨 Log Format Örnekleri

### Konsol Çıktısı (Renkli)
```
2025-11-14 10:30:00 [INFO] [sync-start]: Senkronizasyon başladı {"table":"satislar","recordId":"uuid-123"}
2025-11-14 10:30:00 [INFO] [sync-success]: Senkronizasyon başarılı {"duration":"150ms"}
2025-11-14 10:30:01 [ERROR] [mapping-error]: Mapping bulunamadı {"mappingType":"cari"}
```

### Dosya Çıktısı (Detaylı)
```
2025-11-14 10:30:00 [INFO] [erp-web-sync] [sync-start]: Senkronizasyon başladı
  Meta: {
    "table": "satislar",
    "recordId": "uuid-123",
    "operation": "INSERT",
    "timestamp": "2025-11-14T10:30:00.000Z"
  }
```

## 🔧 Konfigürasyon

### Ortam Değişkenleri

```env
# Log seviyesi (error, warn, info, debug)
LOG_LEVEL=info
```

### Log Seviyesi Değiştirme

```bash
# Production: Sadece hatalar
LOG_LEVEL=error npm start

# Development: Tüm loglar
LOG_LEVEL=debug npm start

# Normal: Info ve üstü
LOG_LEVEL=info npm start
```

## 📈 Performans İzleme

### Yavaş İşlemler

5 saniyeden uzun süren işlemler otomatik olarak uyarı olarak loglanır:

```javascript
// Otomatik performans uyarısı
if (duration > 5000) {
  logger.performance('sync-item', duration, {
    table: item.source_table,
    recordId: item.record_id,
    warning: 'İşlem 5 saniyeden uzun sürdü'
  });
}
```

### Metrik Toplama

```javascript
// Özel metrik
logger.performance('database-query', queryDuration, {
  query: 'SELECT * FROM satislar',
  rowCount: 1000
});
```

## 🚨 Hata Tespiti

### Kritik Hatalar

```javascript
// Veritabanı bağlantı hatası
logger.dbConnection('PostgreSQL', 'failed', error);

// Mapping hatası
logger.mappingError('stok', 'uuid-123');

// Senkronizasyon hatası
logger.syncError('satislar', 'uuid-123', 'INSERT', error);
```

### Hata Kategorileri

1. **Bağlantı Hataları** - `[db-connection]`
2. **Mapping Hataları** - `[mapping-error]`
3. **Senkronizasyon Hataları** - `[sync-error]`
4. **Performans Sorunları** - `[performance]`
5. **Queue Sorunları** - `[queue-status]`

## 🛠️ Sorun Giderme

### Mapping Hatası

```bash
# Hatayı bul
grep "mapping-error" logs/error.log

# Eksik mapping'leri tespit et
SELECT DISTINCT cari_hesap_id 
FROM satislar 
WHERE cari_hesap_id NOT IN (
  SELECT web_cari_id FROM int_kodmap_cari
);

# Mapping ekle
INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) 
VALUES ('uuid-123', '120.01.001');
```

### Performans Sorunu

```bash
# Yavaş işlemleri bul
grep "5 saniyeden uzun" logs/combined.log

# Batch size'ı artır
BATCH_SIZE=100 npm start

# Interval'i azalt
SYNC_INTERVAL_MS=1000 npm start
```

### Bağlantı Sorunu

```bash
# Bağlantı hatalarını bul
grep "db-connection.*failed" logs/error.log

# Bağlantıyı test et
npm run test-connection
```

## 📊 İstatistikler

### Günlük Rapor

```bash
# Bugünün loglarını analiz et
grep "$(date +%Y-%m-%d)" logs/combined.log | npm run analyze-logs

# Başarı oranı
grep "sync-success" logs/sync.log | wc -l
grep "sync-error" logs/sync.log | wc -l
```

### Haftalık Rapor

```bash
# Son 7 günün loglarını analiz et
find logs/ -name "combined.log*" -mtime -7 -exec cat {} \; | npm run analyze-logs
```

## 🔄 Log Rotation

Loglar otomatik olarak rotate edilir:
- Maksimum dosya boyutu: 10MB
- Maksimum dosya sayısı: 10
- Eski dosyalar otomatik silinir

### Manuel Temizlik

```bash
# 7 günden eski logları sil
find logs/ -name "*.log" -mtime +7 -delete

# Tüm logları temizle
rm -rf logs/*.log
```

## 💡 Best Practices

1. **Log Seviyesi**: Production'da `info`, development'ta `debug`
2. **Düzenli Kontrol**: Günlük log analizi yapın
3. **Disk Alanı**: Log klasörünü düzenli temizleyin
4. **Monitoring**: Kritik hataları izleyin
5. **Performans**: Yavaş işlemleri optimize edin

## 🎯 Örnek Senaryolar

### Senaryo 1: Mapping Hatası Tespiti

```bash
# 1. Hatayı tespit et
npm run analyze-logs

# 2. Detayları incele
grep "mapping-error" logs/error.log | tail -10

# 3. Eksik mapping'leri bul
# SQL sorgusu çalıştır

# 4. Mapping'leri ekle
# INSERT komutları çalıştır

# 5. Sistemi yeniden başlat
npm start
```

### Senaryo 2: Performans Optimizasyonu

```bash
# 1. Yavaş işlemleri tespit et
grep "performance" logs/combined.log

# 2. Batch size'ı artır
BATCH_SIZE=100 npm start

# 3. Sonuçları kontrol et
npm run analyze-logs
```

### Senaryo 3: Hata Analizi

```bash
# 1. Hataları listele
npm run analyze-logs error.log

# 2. Belirli bir hatayı incele
grep "uuid-123" logs/error.log

# 3. Stack trace'i kontrol et
cat logs/error.log | grep -A 20 "uuid-123"
```
