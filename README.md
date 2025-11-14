# ERP-Web Senkronizasyon Sistemi

MS SQL (ERP) ve PostgreSQL (Web) veritabanları arasında trigger bazlı, gerçek zamanlı, çift yönlü senkronizasyon sistemi.

## 🚀 Özellikler

- ✅ **Trigger Bazlı**: Veri değişikliği anında tetiklenir
- ✅ **Çift Yönlü**: Web ↔ ERP senkronizasyonu
- ✅ **Gerçek Zamanlı**: 2 saniye içinde senkronize
- ✅ **Hata Toleranslı**: Otomatik retry mekanizması
- ✅ **Mapping Sistemi**: Esnek kod eşleştirme
- ✅ **Transaction Güvenli**: Atomik işlemler
- ✅ **Loglama**: Detaylı işlem kayıtları
- ✅ **Monitoring**: Queue ve log takibi

## 📋 Senkronizasyon Yönleri

### Web → ERP
- Satışlar (başlık + satırlar)
- Tahsilatlar (nakit, kart, havale, çek, senet)
- Alışlar
- Giderler
- Cari hesap güncellemeleri

### ERP → Web
- Stok kartları
- Fiyat listeleri
- Barkod tanımları
- Cari hesap hareketleri

## ⚡ Hızlı Başlangıç

```bash
# 1. Bağımlılıkları kur
npm install

# 2. Ortam değişkenlerini ayarla
cp .env.example .env
# .env dosyasını düzenle

# 3. Bağlantıyı test et
npm run test-connection

# 4. Veritabanı tablolarını oluştur
npm run setup-db

# 5. Başlat
npm start
```

Detaylı kurulum için: [HIZLI-BASLANGIC.md](HIZLI-BASLANGIC.md)

## 📚 Dokümantasyon

- [HIZLI-BASLANGIC.md](HIZLI-BASLANGIC.md) - 5 dakikada kurulum
- [KURULUM.md](KURULUM.md) - Detaylı kurulum kılavuzu
- [PROJE-YAPISI.md](PROJE-YAPISI.md) - Mimari ve modül açıklamaları
- [Mapping.md](Mapping.md) - Alan eşleştirme tabloları

## 🔄 Çalışma Prensibi

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Web App   │         │  Sync Queue  │         │  ERP System │
│ (PostgreSQL)│         │              │         │  (MS SQL)   │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ INSERT satislar       │                        │
       ├──────────────────────>│                        │
       │                       │                        │
       │ Trigger tetiklenir    │                        │
       │ sync_queue'ya ekler   │                        │
       │                       │                        │
       │                       │ Sync Service okur      │
       │                       ├───────────────────────>│
       │                       │                        │
       │                       │ Transform + Mapping    │
       │                       │                        │
       │                       │ INSERT CARI_HESAP_HAR. │
       │                       │ INSERT STOK_HAREKETLERI│
       │                       │<───────────────────────┤
       │                       │                        │
       │                       │ Status: completed      │
       │                       │                        │
```

## 🗂️ Proje Yapısı

```
erp-web-sync/
├── config/              # Konfigürasyon
├── services/            # Veritabanı servisleri
├── transformers/        # Veri dönüştürücüler
├── sync-jobs/           # İşlem processor'ları
├── mappings/            # Mapping yönetimi
├── utils/               # Yardımcı araçlar
├── scripts/             # Kurulum scriptleri
└── logs/                # Log dosyaları
```

## 🔧 Konfigürasyon

`.env` dosyası:

```env
# MS SQL (ERP)
MSSQL_SERVER=192.168.1.100
MSSQL_DATABASE=MIKRO_DB
MSSQL_USER=sa
MSSQL_PASSWORD=***

# PostgreSQL (Web)
PG_HOST=localhost
PG_DATABASE=gurbuzsatis
PG_USER=postgres
PG_PASSWORD=***

# Sync Ayarları
SYNC_INTERVAL_MS=2000
BATCH_SIZE=50
MAX_RETRY_COUNT=3
```

## 📊 Monitoring

### Gerçek Zamanlı Log
```bash
tail -f logs/combined.log
```

### Queue Durumu
```sql
SELECT status, COUNT(*) FROM sync_queue GROUP BY status;
```

### Başarı Oranı
```sql
SELECT status, COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
FROM sync_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

## 🛠️ Sorun Giderme

### Bağlantı Testi
```bash
npm run test-connection
```

### Queue Sıfırlama
```sql
UPDATE sync_queue 
SET status = 'pending', retry_count = 0 
WHERE status = 'processing';
```

### Eksik Mapping Bulma
```sql
SELECT DISTINCT s.cari_hesap_id, c.cari_kodu
FROM satislar s
JOIN cari_hesaplar c ON c.id = s.cari_hesap_id
WHERE s.cari_hesap_id NOT IN (
  SELECT web_cari_id FROM int_kodmap_cari
);
```

## 🚀 Production

### PM2 ile Çalıştırma
```bash
pm2 start index.js --name erp-sync
pm2 save
pm2 startup
```

### Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
```

## 📝 Gereksinimler

- Node.js 16+
- MS SQL Server (ERP)
- PostgreSQL (Web)
- Network erişimi

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun
3. Commit edin
4. Push edin
5. Pull Request açın

## 📄 Lisans

MIT

## 📞 Destek

Sorun yaşarsanız:
1. `logs/error.log` kontrol edin
2. `npm run test-connection` çalıştırın
3. Dokümantasyonu inceleyin
