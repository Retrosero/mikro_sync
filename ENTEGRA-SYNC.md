# Ana Entegra - Web Senkronizasyonu

Bu dokümantasyon, Ana Entegra uygulamasının SQLite veritabanından (`C:\Ana Entegra\db.s3db`) web PostgreSQL veritabanına veri senkronizasyonunu açıklar.

## Senkronize Edilen Tablolar

| Kaynak Tablo (SQLite) | Hedef Tablo (PostgreSQL) | Kayıt Sayısı |
|----------------------|-------------------------|--------------|
| order | entegra_order | ~65,000+ |
| order_status | entegra_order_status | ~18 |
| order_product | entegra_order_product | ~77,000+ |
| pictures | entegra_pictures | ~14,000+ |
| product_quantity | entegra_product_quantity | ~5,700+ |
| product_prices | entegra_product_prices | ~5,700+ |
| product | entegra_product | ~5,700+ |
| product_info | entegra_product_info | ~15,000+ |
| messages | entegra_messages | ~9,000+ |
| message_template | entegra_message_template | 0 |
| customer | entegra_customer | ~54,000+ |

## Senkronizasyon Mantığı

### İlk Senkronizasyon (Tablo Boşsa)
- Tüm veriler SQLite'dan PostgreSQL'e aktarılır

### Günün İlk Senkronizasyonu
- Son **1 ayın** verileri güncellenir/eklenir
- `datetime` alanı olan tablolar tarih filtresini kullanır
- `datetime` alanı olmayan tablolar son 10,000 kayıtı günceller

### Sonraki Senkronizasyonlar (Aynı Gün)
- Sadece son **3 günün** verileri güncellenir
- `datetime` alanı olmayan tablolar son 1,000 kayıtı günceller

### invoice_print Geri Senkronizasyonu
- Web'de `invoice_print` alanı 0'dan 1'e değişen sipariş kayıtları
- SQLite veritabanında da güncellenir

## Kullanım

### Manuel Çalıştırma
```bash
npm run sync-entegra
# veya
node scripts/entegra-sync.js
```

### Otomatik Zamanlama
Windows Task Scheduler ile zamanlanabilir:
```
Trigger: Günlük veya saatlik
Program: node
Arguments: scripts/entegra-sync.js
Start in: C:\Users\Gürbüz Oyuncak\Documents\GitHub\mikro_sync
```

## Performans

- **İlk senkronizasyon**: ~5 dakika (200,000+ kayıt)
- **Günlük güncelleme**: ~1-2 dakika
- **Batch boyutu**: Kolon sayısına göre dinamik hesaplanır (PostgreSQL 65,535 parametre limiti)

## Teknik Detaylar

### Dosyalar
- `scripts/entegra-sync.js` - Ana senkronizasyon scripti
- `services/sqlite.service.js` - SQLite bağlantı servisi
- `sync-state-entegra.json` - Senkronizasyon durumu

### Bağımlılıklar
- `better-sqlite3` - SQLite veritabanı erişimi
- `pg` - PostgreSQL veritabanı erişimi

### Primary Key Olmayan Tablolar
Primary key olmayan tablolar için (örn: product_info):
- Mevcut kayıtlar TRUNCATE edilir
- Tüm veriler yeniden INSERT edilir

## Hata Giderme

### Bağlantı Hatası
```
SQLite bağlantı hatası
```
**Çözüm**: `C:\Ana Entegra\db.s3db` dosyasının mevcut olduğundan emin olun

### PostgreSQL Bağlantı Hatası
**Çözüm**: `.env` dosyasındaki PostgreSQL ayarlarını kontrol edin

### Parametre Limiti Aşıldı
```
Bulk insert hatası: too many parameters
```
**Çözüm**: Batch boyutu otomatik olarak hesaplanır, bu hata olmamalı

## Örnek Çıktı

```
================================================================================
ANA ENTEGRA SENKRONIZASYON BAŞLIYOR
Tarih: 2026-01-05T10:58:09.000Z
================================================================================

Günün ilk senkronizasyonu: EVET (son 1 ay)

============================================================
Senkronizasyon başlıyor: order -> entegra_order
============================================================
Hedef tablo (entegra_order) mevcut kayıt sayısı: 0
Kaynak tablo (order) toplam kayıt sayısı: 65682
Hedef tablo boş, TÜM VERİ aktarılacak
Aktarılacak kayıt sayısı: 65682
Kolon sayısı: 154, Batch boyutu: 389, PK: id
Batch 1: 389 kayıt aktarıldı (1%)
...
Toplam aktarılan kayıt: 65682

================================================================================
SENKRONIZASYON TAMAMLANDI
================================================================================
Toplam süre: 275.95 saniye

Tablo sonuçları:
  order: ✓ - 65682 kayıt
  order_status: ✓ - 18 kayıt
  order_product: ✓ - 77823 kayıt
  pictures: ✓ - 14853 kayıt
  product_quantity: ✓ - 5769 kayıt
  product_prices: ✓ - 5769 kayıt
  product: ✓ - 5761 kayıt
  product_info: ✓ - 15284 kayıt
  messages: ✓ - 3000 kayıt
  message_template: ✓ - 0 kayıt
  invoice_print_sync: 0 güncelleme
```
