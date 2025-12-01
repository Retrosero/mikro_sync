# Web → ERP Senkronizasyon Kurulum Rehberi

## 🎯 Genel Bakış

Bu rehber, Web'den ERP'ye (PostgreSQL → MSSQL) satış ve tahsilat verilerinin otomatik senkronizasyonunu kurmak için gereken adımları açıklar.

## 📋 Ön Gereksinimler

- ✅ Node.js ve npm kurulu olmalı
- ✅ PostgreSQL veritabanı erişimi
- ✅ MSSQL veritabanı erişimi
- ✅ `.env` dosyası doğru yapılandırılmış olmalı

## 🚀 Kurulum Adımları

### 1. Trigger'ları Kur

PostgreSQL veritabanında Web → ERP senkronizasyonu için gerekli trigger'ları kurun:

```bash
npm run setup-web-to-erp-triggers
```

Bu komut:
- ✅ `sync_queue` tablosunu oluşturur
- ✅ Satış ve tahsilat trigger'larını kurar
- ✅ `kaynak` alanlarını ekler (eğer yoksa)

**Beklenen Çıktı:**
```
Web -> ERP Sync Trigger'ları kuruluyor...
======================================================================
✓ Trigger'lar başarıyla kuruldu!
======================================================================
Sync queue tablosu hazır (0 kayıt)

Kurulu Trigger'lar:
  ✓ satis_sync_trigger -> satislar (AFTER INSERT)
  ✓ tahsilat_sync_trigger -> tahsilatlar (AFTER INSERT)
```

### 2. Sync Queue Worker'ı Başlat

Web'den gelen değişiklikleri sürekli olarak ERP'ye aktaran worker servisi:

```bash
npm run sync-queue-worker
```

Bu servis:
- 🔄 Her 5 saniyede bir `sync_queue` tablosunu kontrol eder
- 📤 Bekleyen kayıtları ERP'ye gönderir
- ♻️ Hata durumunda 3 kez tekrar dener
- 📊 Her 30 saniyede bir istatistik gösterir

**Beklenen Çıktı:**
```
Sync queue worker başlatıldı
Queue İstatistikleri: { pending: 0, completed: 5, failed: 0 }
```

> **Not:** Bu servisi arka planda sürekli çalışır durumda tutmalısınız (PM2, systemd, vb. ile)

### 3. Çift Yönlü Senkronizasyon

Hem ERP → Web hem de Web → ERP senkronizasyonunu tek seferde çalıştırın:

```bash
npm run sync-bidirectional
```

Bu komut:
1. 📥 ERP → Web: Tüm master verileri senkronize eder
2. 📤 Web → ERP: Bekleyen satış ve tahsilat kayıtlarını gönderir

## 📊 Veri Akışı

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB UYGULAMASI                           │
│  (PostgreSQL)                                               │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Satış/Tahsilat Oluşturuldu
             ↓
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Trigger                             │
│  • notify_satis_sync()                                      │
│  • notify_tahsilat_sync()                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             │ sync_queue'ya Kayıt Ekle
             ↓
┌─────────────────────────────────────────────────────────────┐
│                  SYNC_QUEUE Tablosu                         │
│  • entity_type: 'satis' | 'tahsilat'                        │
│  • status: 'pending'                                        │
│  • retry_count: 0                                           │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Her 5 saniyede bir kontrol
             ↓
┌─────────────────────────────────────────────────────────────┐
│            Sync Queue Worker                                │
│  • Bekleyen kayıtları al                                    │
│  • Processor'lara gönder                                    │
│  • Hata yönetimi ve retry                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─── Satış ise → satis.processor.js
             │                      │
             │                      ↓
             │              CARI_HESAP_HAREKETLERI
             │              STOK_HAREKETLERI
             │
             └─── Tahsilat ise → tahsilat.processor.js
                                      │
                                      ↓
                              ODEME_EMIRLERI (çek/senet)
                              CARI_HESAP_HAREKETLERI
```

## 🔍 Monitoring ve Kontrol

### Queue Durumunu Kontrol Et

```sql
-- Bekleyen kayıtlar
SELECT * FROM sync_queue WHERE status = 'pending';

-- Başarısız kayıtlar
SELECT * FROM sync_queue WHERE status = 'failed';

-- İstatistikler
SELECT status, COUNT(*) as count 
FROM sync_queue 
GROUP BY status;
```

### Log Dosyalarını İncele

```bash
# Ana log dosyası
tail -f logs/combined.log

# Sadece hatalar
tail -f logs/error.log
```

## ⚙️ Yapılandırma

### Sync Queue Worker Ayarları

`services/sync-queue-worker.js` dosyasında:

```javascript
this.pollInterval = 5000;  // Kontrol aralığı (ms)
this.maxRetries = 3;       // Maksimum tekrar deneme sayısı
```

### Trigger Ayarları

Trigger'lar sadece `kaynak = 'web'` olan kayıtları senkronize eder. Bu sayede ERP'den gelen veriler tekrar ERP'ye gönderilmez (döngü engellenir).

## 🛠️ Sorun Giderme

### Trigger'lar Çalışmıyor

**Kontrol:**
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name IN ('satis_sync_trigger', 'tahsilat_sync_trigger');
```

**Çözüm:**
```bash
npm run setup-web-to-erp-triggers
```

### Kayıtlar Failed Durumunda

**Kontrol:**
```sql
SELECT entity_type, error_message, COUNT(*) 
FROM sync_queue 
WHERE status = 'failed' 
GROUP BY entity_type, error_message;
```

**Çözüm:**
1. Hata mesajını inceleyin
2. Mapping tablolarını kontrol edin (`int_kodmap_cari`, `int_kodmap_stok`)
3. Failed kayıtları pending'e geri alın:
```sql
UPDATE sync_queue 
SET status = 'pending', retry_count = 0 
WHERE status = 'failed';
```

### Worker Çalışmıyor

**Kontrol:**
```bash
ps aux | grep sync-queue-worker
```

**Çözüm:**
```bash
# Worker'ı yeniden başlat
npm run sync-queue-worker
```

## 📝 Önemli Notlar

1. **Trigger Döngülerini Önleme:** `kaynak` alanı kullanılarak ERP'den gelen kayıtlar tekrar ERP'ye gönderilmez.

2. **Transaction Yönetimi:** Tüm ERP yazma işlemleri transaction içinde yapılır. Hata durumunda rollback yapılır.

3. **Sequence Numaraları:** Evrak numaraları otomatik olarak ERP'den alınır (`getNextEvrakNo`).

4. **RECno İlişkileri:** Ana kayıt ve alt kayıtlar arasındaki ilişki `RECno` ile sağlanır.

5. **Sürekli Çalışma:** Production ortamında `sync-queue-worker` servisini PM2 veya systemd ile sürekli çalışır durumda tutun.

## 🎯 Production Deployment

### PM2 ile Çalıştırma

```bash
# PM2 kur (eğer yoksa)
npm install -g pm2

# Worker'ı başlat
pm2 start services/sync-queue-worker.js --name "sync-queue-worker"

# Otomatik başlatma
pm2 startup
pm2 save

# Durumu kontrol et
pm2 status
pm2 logs sync-queue-worker
```

### Systemd ile Çalıştırma

`/etc/systemd/system/sync-queue-worker.service`:

```ini
[Unit]
Description=ERP Web Sync Queue Worker
After=network.target postgresql.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/mikro_sync
ExecStart=/usr/bin/node services/sync-queue-worker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable sync-queue-worker
sudo systemctl start sync-queue-worker
sudo systemctl status sync-queue-worker
```

## 📞 Destek

Sorun yaşarsanız:
1. Log dosyalarını kontrol edin
2. `sync_queue` tablosunu inceleyin
3. Mapping tablolarını doğrulayın
4. Test script'lerini çalıştırın: `npm run test-web-to-erp-sync`
