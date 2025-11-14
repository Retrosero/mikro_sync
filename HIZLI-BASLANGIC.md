# Hızlı Başlangıç Kılavuzu

## 5 Dakikada Kurulum

### 1. Bağımlılıkları Kurun (30 saniye)

```bash
npm install
```

### 2. Ortam Değişkenlerini Ayarlayın (1 dakika)

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:

```env
# MS SQL (ERP)
MSSQL_SERVER=192.168.1.100
MSSQL_DATABASE=MIKRO_DB
MSSQL_USER=sa
MSSQL_PASSWORD=YourPassword

# PostgreSQL (Web)
PG_HOST=localhost
PG_DATABASE=gurbuzsatis
PG_USER=postgres
PG_PASSWORD=YourPassword
```

### 3. Bağlantıyı Test Edin (30 saniye)

```bash
npm run test-connection
```

Çıktı şöyle olmalı:
```
✓ PostgreSQL bağlantısı başarılı
✓ MS SQL bağlantısı başarılı
```

### 4. Veritabanı Tablolarını Oluşturun (1 dakika)

```bash
npm run setup-db
```

Bu komut:
- Trigger'ları oluşturur
- Queue tablolarını oluşturur
- Mapping tablolarını oluşturur

### 5. Mapping Verilerini Ekleyin (2 dakika)

#### Otomatik Mapping (Önerilen)

PostgreSQL'de çalıştırın:

```sql
-- Mevcut cari hesapları için otomatik mapping
INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod)
SELECT 
  c.id,
  c.cari_kodu
FROM cari_hesaplar c
WHERE c.cari_kodu IS NOT NULL
ON CONFLICT (web_cari_id) DO NOTHING;

-- Mevcut stoklar için otomatik mapping
INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod)
SELECT 
  s.id,
  s.stok_kodu
FROM stoklar s
WHERE s.stok_kodu IS NOT NULL
ON CONFLICT (web_stok_id) DO NOTHING;
```

#### Manuel Mapping

Eğer kodlar farklıysa, manuel olarak ekleyin:

```sql
-- Örnek: Web'de UUID, ERP'de '120.01.001'
INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) 
VALUES ('uuid-buraya', '120.01.001');
```

### 6. Başlatın! (5 saniye)

```bash
npm start
```

Çıktı:
```
✓ PostgreSQL bağlantısı başarılı
✓ MS SQL bağlantısı başarılı
✓ Lookup cache yüklendi
Senkronizasyon başlatılıyor...
```

## İlk Test

### Test 1: Satış Senkronizasyonu

1. Web uygulamanızda yeni bir satış oluşturun
2. Logları izleyin:
   ```bash
   tail -f logs/combined.log
   ```
3. ERP'de kontrol edin:
   ```sql
   SELECT TOP 10 * FROM CARI_HESAP_HAREKETLERI 
   ORDER BY cha_create_date DESC
   ```

### Test 2: Stok Senkronizasyonu

1. ERP'de bir stok kartını güncelleyin
2. Web'de kontrol edin:
   ```sql
   SELECT * FROM stoklar 
   WHERE guncelleme_tarihi > NOW() - INTERVAL '5 minutes';
   ```

## Sorun Giderme

### "Cari mapping bulunamadı" Hatası

```sql
-- Eksik mapping'leri bulun
SELECT DISTINCT s.cari_hesap_id, c.cari_kodu, c.cari_adi
FROM satislar s
JOIN cari_hesaplar c ON c.id = s.cari_hesap_id
WHERE s.cari_hesap_id NOT IN (
  SELECT web_cari_id FROM int_kodmap_cari
);

-- Ekleyin
INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) 
VALUES ('bulunan-uuid', 'erp-kodu');
```

### "Stok mapping bulunamadı" Hatası

```sql
-- Eksik mapping'leri bulun
SELECT DISTINCT sk.stok_id, s.stok_kodu, s.stok_adi
FROM satis_kalemleri sk
JOIN stoklar s ON s.id = sk.stok_id
WHERE sk.stok_id NOT IN (
  SELECT web_stok_id FROM int_kodmap_stok
);

-- Ekleyin
INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) 
VALUES ('bulunan-uuid', 'erp-kodu');
```

### Queue Takıldı

```sql
-- PostgreSQL: Sıfırla
UPDATE sync_queue 
SET status = 'pending', retry_count = 0 
WHERE status = 'processing';
```

## Monitoring

### Gerçek Zamanlı Log İzleme

```bash
# Tüm loglar
tail -f logs/combined.log

# Sadece hatalar
tail -f logs/error.log

# Filtreleme
tail -f logs/combined.log | grep "ERROR"
```

### Veritabanı İstatistikleri

```sql
-- PostgreSQL: Queue durumu
SELECT status, COUNT(*) 
FROM sync_queue 
GROUP BY status;

-- Son 10 işlem
SELECT * FROM sync_logs 
ORDER BY created_at DESC 
LIMIT 10;

-- Başarı oranı
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM sync_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

## Performans İpuçları

### Yavaş Çalışıyorsa

1. Batch size'ı artırın:
   ```env
   BATCH_SIZE=100
   ```

2. Interval'i azaltın:
   ```env
   SYNC_INTERVAL_MS=1000
   ```

3. Index'leri kontrol edin:
   ```sql
   -- PostgreSQL
   SELECT * FROM pg_indexes 
   WHERE tablename = 'sync_queue';
   ```

### Çok Fazla Log Birikiyor

```bash
# Eski logları temizle
find logs/ -name "*.log" -mtime +7 -delete

# Veritabanı temizliği
psql -U postgres -d gurbuzsatis -c "SELECT cleanup_old_sync_records();"
```

## Üretim Ortamına Geçiş

### 1. PM2 ile Çalıştırma

```bash
npm install -g pm2

pm2 start index.js --name erp-sync
pm2 save
pm2 startup
```

### 2. Otomatik Yeniden Başlatma

```bash
pm2 start index.js --name erp-sync --watch --ignore-watch="logs"
```

### 3. Log Rotation

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Yardım

Sorun yaşıyorsanız:

1. Logları kontrol edin: `logs/error.log`
2. Bağlantıyı test edin: `npm run test-connection`
3. Queue'yu kontrol edin: `SELECT * FROM sync_queue WHERE status = 'failed'`
4. Mapping'leri doğrulayın: `SELECT COUNT(*) FROM int_kodmap_cari`

Detaylı bilgi için: `KURULUM.md`
