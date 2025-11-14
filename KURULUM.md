# ERP-Web Senkronizasyon Sistemi Kurulum Kılavuzu

## Gereksinimler

- Node.js 16+ 
- MS SQL Server (ERP veritabanı)
- PostgreSQL (Web veritabanı)
- Network erişimi (her iki veritabanına)

## Kurulum Adımları

### 1. Projeyi İndirin ve Bağımlılıkları Kurun

```bash
npm install
```

### 2. Ortam Değişkenlerini Ayarlayın

`.env.example` dosyasını `.env` olarak kopyalayın ve düzenleyin:

```bash
cp .env.example .env
```

`.env` dosyasını açın ve veritabanı bilgilerinizi girin:

```env
# MS SQL (ERP) Configuration
MSSQL_SERVER=192.168.1.100
MSSQL_PORT=1433
MSSQL_DATABASE=MIKRO_DB
MSSQL_USER=sa
MSSQL_PASSWORD=YourPassword123

# PostgreSQL (Web) Configuration
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=gurbuzsatis
PG_USER=postgres
PG_PASSWORD=YourPassword123

# Sync Configuration
SYNC_INTERVAL_MS=2000
BATCH_SIZE=50
MAX_RETRY_COUNT=3
LOG_LEVEL=info
```

### 3. Veritabanı Tablolarını ve Trigger'ları Oluşturun

```bash
npm run setup-db
```

Bu komut:
- PostgreSQL'de `sync_queue`, mapping tabloları ve trigger'ları oluşturur
- MS SQL'de `SYNC_QUEUE`, mapping tabloları ve trigger'ları oluşturur

### 4. Mapping Tablolarını Doldurun

#### Cari Mapping Örneği (PostgreSQL)

```sql
INSERT INTO int_kodmap_cari (web_cari_id, erp_cari_kod) 
VALUES 
  ('uuid-1', '120.01.001'),
  ('uuid-2', '120.01.002');
```

#### Stok Mapping Örneği (PostgreSQL)

```sql
INSERT INTO int_kodmap_stok (web_stok_id, erp_stok_kod) 
VALUES 
  ('uuid-1', 'URN001'),
  ('uuid-2', 'URN002');
```

#### Banka Mapping Örneği (PostgreSQL)

```sql
INSERT INTO int_kodmap_banka (web_banka_id, erp_banka_kod) 
VALUES 
  ('uuid-1', 'BNK001');
```

#### Kasa Mapping Örneği (PostgreSQL)

```sql
INSERT INTO int_kodmap_kasa (web_kasa_id, erp_kasa_kod) 
VALUES 
  ('uuid-1', 'KSA001');
```

### 5. Uygulamayı Başlatın

```bash
npm start
```

Geliştirme modunda (otomatik yeniden başlatma):

```bash
npm run dev
```

## Çalışma Prensibi

### Trigger Bazlı Senkronizasyon

1. **Web'de Satış Oluşturulduğunda:**
   - `satislar` tablosuna INSERT → Trigger tetiklenir
   - `sync_queue` tablosuna kayıt eklenir
   - Sync service queue'dan okur
   - Mapping ile ERP kodlarını bulur
   - ERP'ye (MS SQL) yazar

2. **ERP'de Stok Güncellendiğinde:**
   - `STOKLAR` tablosunda UPDATE → Trigger tetiklenir
   - `SYNC_QUEUE` tablosuna kayıt eklenir
   - Sync service queue'dan okur
   - Web'e (PostgreSQL) yazar

### Senkronizasyon Yönleri

**Web → ERP:**
- Satışlar (satislar, satis_kalemleri)
- Tahsilatlar
- Alışlar
- Giderler
- Cari güncellemeleri

**ERP → Web:**
- Stok kartları
- Fiyat listeleri
- Barkodlar
- Cari hesap hareketleri

## Monitoring

### Log Dosyaları

- `logs/combined.log` - Tüm loglar
- `logs/error.log` - Sadece hatalar

### Veritabanı Logları

```sql
-- PostgreSQL: Son 100 senkronizasyon
SELECT * FROM sync_logs 
ORDER BY created_at DESC 
LIMIT 100;

-- Başarısız işlemler
SELECT * FROM sync_logs 
WHERE status = 'FAILED' 
ORDER BY created_at DESC;

-- Queue durumu
SELECT status, COUNT(*) 
FROM sync_queue 
GROUP BY status;
```

## Sorun Giderme

### Bağlantı Hataları

```bash
# PostgreSQL bağlantısını test et
psql -h localhost -U postgres -d gurbuzsatis

# MS SQL bağlantısını test et
sqlcmd -S localhost -U sa -P YourPassword
```

### Queue Takılması

```sql
-- PostgreSQL: Takılı kayıtları sıfırla
UPDATE sync_queue 
SET status = 'pending', retry_count = 0 
WHERE status = 'processing' 
AND created_at < NOW() - INTERVAL '10 minutes';
```

### Mapping Eksikliği

Eğer "Cari mapping bulunamadı" hatası alıyorsanız:

```sql
-- Eksik mapping'leri bul
SELECT DISTINCT cari_hesap_id 
FROM satislar 
WHERE cari_hesap_id NOT IN (
  SELECT web_cari_id FROM int_kodmap_cari
);
```

## Performans İyileştirme

### Index'ler

```sql
-- PostgreSQL
CREATE INDEX IF NOT EXISTS idx_sync_queue_status 
ON sync_queue(status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_satislar_tarih 
ON satislar(satis_tarihi);
```

### Batch Size Ayarı

`.env` dosyasında `BATCH_SIZE` değerini artırın:

```env
BATCH_SIZE=100  # Daha hızlı işlem
```

### Interval Ayarı

```env
SYNC_INTERVAL_MS=1000  # Daha sık kontrol
```

## Bakım

### Eski Kayıtları Temizleme

```sql
-- PostgreSQL
SELECT cleanup_old_sync_records();

-- MS SQL
EXEC sp_cleanup_old_sync_records;
```

### Cron Job (Opsiyonel)

```bash
# Her gece 02:00'de temizlik
0 2 * * * psql -U postgres -d gurbuzsatis -c "SELECT cleanup_old_sync_records();"
```

## Güvenlik

- `.env` dosyasını asla commit etmeyin
- Veritabanı kullanıcılarına minimum yetki verin
- Logları düzenli olarak temizleyin
- SSL/TLS bağlantıları kullanın (production)

## Destek

Sorun yaşarsanız:
1. `logs/error.log` dosyasını kontrol edin
2. `sync_logs` tablosunu inceleyin
3. Mapping tablolarını doğrulayın
