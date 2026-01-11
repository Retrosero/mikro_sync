# 🔄 Senkronizasyon Sistemi Rehberi

Bu doküman, **mikro_sync** uygulamasının tüm senkronizasyon süreçlerini, veri akışlarını ve yönetim önerilerini detaylı şekilde açıklamaktadır.

---

## 📋 İÇİNDEKİLER

1. [Genel Bakış](#genel-bakış)
2. [Senkronizasyon Türleri](#senkronizasyon-türleri)
3. [Komutlar ve Çalıştırma](#komutlar-ve-çalıştırma)
4. [Veri Akış Şemaları](#veri-akış-şemaları)
5. [Tablo Eşlemeleri](#tablo-eşlemeleri)
6. [Hata Yönetimi](#hata-yönetimi)
7. [Yönetim Önerileri](#yönetim-önerileri)
8. [Sorun Giderme](#sorun-giderme)

---

## 🎯 Genel Bakış

Sistem üç ana veritabanı arasında veri senkronizasyonu sağlar:

| Veritabanı | Tür | Açıklama |
|------------|-----|----------|
| **Mikro ERP** | MS SQL Server | Ana muhasebe ve stok yönetim sistemi |
| **Web (Supabase)** | PostgreSQL | Web uygulaması veritabanı |
| **Entegra** | SQLite (db.s3db) | Pazaryeri entegrasyon veritabanı |

### Veri Akış Yönleri

```
┌─────────────────┐     ┌───────────────┐     ┌─────────────────┐
│   Mikro ERP     │◄───►│   Web (PG)    │◄───►│    Entegra      │
│   (MS SQL)      │     │  (PostgreSQL) │     │   (SQLite)      │
└─────────────────┘     └───────────────┘     └─────────────────┘
        │                       │                      │
        │  Stok, Fiyat, Cari    │  Sipariş, Ürün      │
        │  Kategori, Barkod     │  Fotoğraf, Mesaj    │
        │  ◄────────────────    │  ◄──────────────    │
        │                       │                      │
        │  Satış, Tahsilat      │  Fatura Print       │
        │  İade, Sayım          │  ──────────────►    │
        │  ────────────────►    │                      │
        └───────────────────────┴──────────────────────┘
```

---

## 🔀 Senkronizasyon Türleri

### 1️⃣ ERP → Web Senkronizasyonu (`npm run sync`)

**Kaynak:** Mikro ERP (MS SQL)  
**Hedef:** Web Veritabanı (PostgreSQL)

#### Aktarılan Veriler:

| ERP Tablosu | Web Tablosu | Açıklama |
|-------------|-------------|----------|
| `STOKLAR` | `stoklar` | Ürün ana bilgileri |
| `BARKOD_TANIMLARI` | `urun_barkodlari` | Barkod bilgileri |
| `STOK_SATIS_FIYAT_LISTELERI` | `fiyatlar` | Satış fiyatları |
| `CARI_HESAPLAR` | `cari_hesaplar` | Müşteri/Tedarikçi bilgileri |
| `STOK_ANA_GRUPLARI` | `kategoriler` (level=0) | Ana kategoriler |
| `STOK_ALT_GRUPLARI` | `kategoriler` (level=1) | Alt kategoriler |
| `BANKALAR` | `bankalar` | Banka tanımları |
| `KASALAR` | `kasalar` | Kasa tanımları |
| `DEPOLAR` | `depolar` | Depo tanımları |
| `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW` | `stoklar.eldeki_miktar` | Anlık stok miktarları |

#### Senkronizasyon Mantığı:
1. **Batch İşleme:** Veriler `BATCH_SIZE` (varsayılan 5000) kadar parçalara bölünür
2. **Upsert:** `ON CONFLICT DO UPDATE` ile mevcut kayıtlar güncellenir, yeniler eklenir
3. **Mapping:** Her kayıt için `int_kodmap_*` tablolarında ERP↔Web ID eşlemesi tutulur

---

### 2️⃣ Web → ERP Senkronizasyonu (`npm run sync-web-to-erp`)

**Kaynak:** Web Veritabanı (PostgreSQL)  
**Hedef:** Mikro ERP (MS SQL)

#### Aktarılan Veriler:

| Web Tablosu | ERP Tablosu | Processor | Açıklama |
|-------------|-------------|-----------|----------|
| `satislar` + `satis_kalemleri` | `CARI_HESAP_HAREKETLERI` + `STOK_HAREKETLERI` | `satis.processor.js` | Satış faturaları |
| `tahsilatlar` | `CARI_HESAP_HAREKETLERI` | `tahsilat.processor.js` | Tahsilat kayıtları |
| `iadeler` + `iade_kalemleri` | `CARI_HESAP_HAREKETLERI` + `STOK_HAREKETLERI` | `iade.processor.js` | İade faturaları |
| `alislar` + `alis_kalemleri` | `CARI_HESAP_HAREKETLERI` + `STOK_HAREKETLERI` | `alis.processor.js` | Alış faturaları |
| `stok_hareketleri` | `STOK_HAREKETLERI` | `stok-hareket.processor.js` | Sayım fişleri, transfer |
| `stoklar` | `STOKLAR` | `stok.processor.js` | Yeni ürün ekleme |
| `urun_barkodlari` | `BARKOD_TANIMLARI` | `barkod.processor.js` | Barkod ekleme/silme |

#### Senkronizasyon Mantığı:
1. **Queue Tabanlı:** `sync_queue` tablosunda bekleyen kayıtlar işlenir
2. **Trigger ile Tetikleme:** Web'de kayıt eklendiğinde/güncellendiğinde trigger devreye girer
3. **Transaction:** Her işlem atomik olarak gerçekleştirilir
4. **Retry Mekanizması:** Hata durumunda 3 deneme yapılır

#### Evrak Numaralama:
- Her satış için benzersiz evrak numarası alınır
- `cha_evrakno_seri` + `cha_evrakno_sira` kombinasyonu kullanılır
- Hem ERP hem de mapping tablosundaki en yüksek numara kontrol edilir

---

### 3️⃣ Entegra Senkronizasyonu (`npm run sync-entegra`)

**Kaynak:** Entegra SQLite (db.s3db)  
**Hedef:** Web Veritabanı (PostgreSQL)

#### Aktarılan Veriler:

| SQLite Tablosu | PostgreSQL Tablosu | Açıklama |
|----------------|-------------------|----------|
| `order` | `entegra_order` | Pazaryeri siparişleri |
| `order_product` | `entegra_order_product` | Sipariş ürünleri |
| `order_status` | `entegra_order_status` | Sipariş durumları |
| `product` | `entegra_product` | Ürün tanımları |
| `pictures` | `entegra_pictures` | Ürün fotoğrafları |
| `product_quantity` | `entegra_product_quantity` | Stok miktarları |
| `product_prices` | `entegra_product_prices` | Fiyat bilgileri |
| `customer` | `entegra_customer` | Müşteri bilgileri |
| `messages` | `entegra_messages` | Pazaryeri mesajları |
| `brand` | `entegra_brand` | Marka tanımları |
| `category` / `category2` | `entegra_category` / `entegra_category2` | Kategori tanımları |

#### Senkronizasyon Stratejisi:
```
┌─────────────────────────────────────────────────────────────┐
│                  SENKRONIZASYON STRATEJİSİ                   │
├─────────────────────────────────────────────────────────────┤
│ Hedef tablo boş ise:                                        │
│   → Tüm veriyi aktar (Full Sync)                            │
├─────────────────────────────────────────────────────────────┤
│ Günün ilk senkronizasyonu ise:                              │
│   → Son 1 ayın verilerini güncelle                          │
├─────────────────────────────────────────────────────────────┤
│ Sonraki senkronizasyonlar:                                  │
│   → Son 3 günün verilerini güncelle                         │
├─────────────────────────────────────────────────────────────┤
│ product_quantity tablosu:                                   │
│   → Her zaman TRUNCATE + INSERT (tam yenileme)              │
└─────────────────────────────────────────────────────────────┘
```

#### Çift Yönlü Akış (invoice_print):
- Web'de `entegra_order.invoice_print` alanı 0'dan 1'e dönerse
- Bu değişiklik SQLite'a geri yazılır
- Fatura basım durumu Entegra'ya iletilmiş olur

---

### 4️⃣ Stok XML Senkronizasyonu (`npm run stock-xml`)

**Kaynak:** Mikro ERP (MS SQL) + Entegra Fotoğrafları (PostgreSQL)  
**Hedef:** 
- PostgreSQL `xmlurunler` tablosu
- Sunucu XML dosyası (`sadece-stoklar.xml`)

#### Aktarılan Veriler:

| Alan | Kaynak | Açıklama |
|------|--------|----------|
| `product_id` | `STOKLAR.sto_RECno` | ERP kayıt numarası |
| `product_code` | `STOKLAR.sto_kod` | Stok kodu |
| `name` | `STOKLAR.sto_isim` | Ürün adı |
| `brand` | `STOKLAR.sto_marka_kodu` | Marka kodu |
| `barcode` | `BARKOD_TANIMLARI.bar_kodu` | Barkod (ilk kayıt) |
| `stock` | `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW` | Eldeki miktar |
| `price` | `STOK_SATIS_FIYAT_LISTELERI` (Liste 1) | Satış fiyatı |
| `Price2` | `STOK_SATIS_FIYAT_LISTELERI` (Liste 2) | 2. Fiyat listesi |
| `Pricebayi` | `STOK_SATIS_FIYAT_LISTELERI` (Liste 3) | Bayi fiyatı |
| `images` | `entegra_pictures` | Ürün fotoğrafları (dizi) |
| `images1-9` | `entegra_pictures` | Tek tek fotoğraf URL'leri |
| `raf_numarasi` | `STOKLAR.sto_yer_kod` | Raf/konum bilgisi |
| `grup_kod` | `STOKLAR.sto_altgrup_kod` | Alt grup kodu |
| `ana_grup_kod` | `STOKLAR.sto_anagrup_kod` | Ana grup kodu |

#### İşlem Akışı:
1. MS SQL'den stok verileri çekilir
2. PostgreSQL'den fotoğraflar `entegra_pictures` tablosundan eşleştirilir
3. `xmlurunler` tablosuna UPSERT yapılır
4. XML dosyası oluşturulur
5. SSH/SCP ile sunucuya yüklenir
6. Docker konteynerlarına dağıtılır

---

## 💻 Komutlar ve Çalıştırma

### Temel Komutlar

```bash
# ERP → Web Senkronizasyonu (Stok, Fiyat, Cari vb.)
npm run sync

# Web → ERP Senkronizasyonu (Satış, Tahsilat, İade vb.)
npm run sync-web-to-erp

# Entegra → Web Senkronizasyonu (Sipariş, Ürün, Fotoğraf vb.)
npm run sync-entegra

# Stok XML Oluşturma ve Yükleme
npm run stock-xml

# Sürekli Çalışan Servis (Periyodik senkronizasyon)
npm start
```

### Yardımcı Komutlar

```bash
# Veritabanı bağlantı testi
npm run test-connection

# Trigger'ları kur
npm run setup-triggers
npm run setup-web-to-erp-triggers

# Queue worker (ayrı process olarak çalıştır)
npm run sync-queue-worker

# Fiyat listesi eşlemelerini oluştur
npm run create-price-mappings

# Eksik cari eşlemelerini düzelt
npm run fix-cari
```

---

## 📊 Tablo Eşlemeleri (Mapping Tabloları)

Sistem, ERP ve Web arasındaki ID eşlemelerini aşağıdaki tablolarda tutar:

| Tablo | Kaynak (Web) | Hedef (ERP) | Açıklama |
|-------|--------------|-------------|----------|
| `int_kodmap_cari` | `web_cari_id` | `erp_cari_kod` | Cari hesap eşlemesi |
| `int_kodmap_stok` | `web_stok_id` | `erp_stok_kod` | Stok kodu eşlemesi |
| `int_kodmap_banka` | `web_banka_id` | `erp_banka_kod` | Banka eşlemesi |
| `int_kodmap_kasa` | `web_kasa_id` | `erp_kasa_kod` | Kasa eşlemesi |
| `int_kodmap_fiyat_liste` | `web_fiyat_tanimi_id` | `erp_liste_no` | Fiyat listesi eşlemesi |
| `int_satis_mapping` | `web_satis_id` | `erp_evrak_seri` + `erp_evrak_no` | Satış evrak eşlemesi |

### Önemli Notlar:
- Eşleme bulunamazsa, sistem otomatik olarak ana tablolardan (`cari_hesaplar.cari_kodu`, `stoklar.stok_kodu` vb.) kodu bulmaya çalışır
- Yeni eşleme otomatik olarak cache'e eklenir (5 dakika TTL)

---

## ⚠️ Hata Yönetimi

### Retry Mekanizması

```
┌─────────────────────────────────────────────────────────────┐
│                     HATA DURUMU                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Deneme başarısız → 2. denemeye geç                       │
│ 2. Deneme başarısız → 3. denemeye geç                       │
│ 3. Deneme başarısız → Kayıt "failed" durumuna alınır        │
└─────────────────────────────────────────────────────────────┘
```

### Yaygın Hatalar ve Çözümleri

| Hata | Sebep | Çözüm |
|------|-------|-------|
| `Stok mapping bulunamadı: null` | Satış kaleminde `stok_id` NULL | Web'de ürünü kontrol et, `stok_id` ata |
| `Cari mapping bulunamadı` | Müşteri ERP'de yok | `npm run fix-cari` çalıştır |
| `ON CONFLICT cannot affect row a second time` | Aynı kayıt batch'te birden fazla | Benzersizlik kontrolü ekle |
| `duplicate key value violates unique constraint` | Benzersiz alan ihlali | Constraintleri gözden geçir |

### Log Dosyaları

```
logs/
├── combined.log      # Tüm loglar
├── error.log         # Sadece hatalar
└── sync.log          # Senkronizasyon logları
```

---

## 🛠️ Yönetim Önerileri

### 1. Zamanlanmış Görevler (Önerilen Cron Yapısı)

```bash
# Her 15 dakikada ERP → Web senkronizasyonu
*/15 * * * * cd /path/to/mikro_sync && npm run sync >> logs/cron.log 2>&1

# Her 5 dakikada Web → ERP senkronizasyonu
*/5 * * * * cd /path/to/mikro_sync && npm run sync-web-to-erp >> logs/cron.log 2>&1

# Her 10 dakikada Entegra senkronizasyonu
*/10 * * * * cd /path/to/mikro_sync && npm run sync-entegra >> logs/cron.log 2>&1

# Her saat başı XML güncelleme
0 * * * * cd /path/to/mikro_sync && npm run stock-xml >> logs/cron.log 2>&1
```

### 2. İzleme ve Uyarı Sistemi

**Önerilen:** Log dosyalarını izleyen bir sistem kurun:

```bash
# Hata sayısını kontrol et
grep -c "error" logs/combined.log

# Son 100 hatayı görüntüle
grep "error" logs/combined.log | tail -100
```

### 3. Yedekleme Stratejisi

- **sync-state-entegra.json:** Entegra senkronizasyon durumu
- **logs/:** Log dosyaları
- **.env:** Konfigürasyon (hassas veri!)

```bash
# Günlük yedekleme örneği
cp sync-state-entegra.json backups/sync-state-$(date +%Y%m%d).json
```

### 4. Performans Optimizasyonu

| Parametre | Dosya | Varsayılan | Öneri |
|-----------|-------|------------|-------|
| `BATCH_SIZE` | `.env` | 5000 | Yüksek RAM varsa 10000 |
| `SYNC_INTERVAL_MS` | `.env` | 60000 | İhtiyaca göre ayarla |
| `MAX_RETRY_COUNT` | `.env` | 3 | 3 yeterli |

### 5. Güvenlik Önerileri

1. **SSH Key Yönetimi:** `SSH_PRIVATE_KEY_PATH` dosyasının izinlerini kısıtla
2. **Veritabanı Şifreleri:** `.env` dosyasını Git'e ekleme
3. **IP Kısıtlaması:** Veritabanı sunucularına sadece izinli IP'lerden erişim

### 6. Ölçeklendirme Önerileri

- **Yüksek Hacim:** Ayrı sunucuda queue worker çalıştır
- **Çoklu Mağaza:** Her mağaza için ayrı `.env` dosyası
- **Yük Dengeleme:** Kritik senkronizasyonları farklı zamanlara yay

---

## 🔧 Sorun Giderme

### Senkronizasyon Durmuşsa

```bash
# Queue durumunu kontrol et
node -e "require('dotenv').config(); require('./services/postgresql.service').query('SELECT status, COUNT(*) FROM sync_queue GROUP BY status').then(console.log)"

# Başarısız kayıtları sıfırla
node -e "require('dotenv').config(); require('./services/postgresql.service').query(\"UPDATE sync_queue SET status='pending', retry_count=0 WHERE status='failed'\")"
```

### Eşleme Eksikse

```bash
# Eksik cari eşlemelerini bul
npm run fix-cari

# Eksik stok eşlemelerini kontrol et
node -e "require('dotenv').config(); require('./services/postgresql.service').query('SELECT stok_kodu FROM stoklar WHERE id NOT IN (SELECT web_stok_id FROM int_kodmap_stok)').then(r => console.log(r.length, 'eksik'))"
```

### Veritabanı Bağlantı Sorunu

```bash
# Bağlantı testi
npm run test-connection

# Manuel kontrol
node -e "require('dotenv').config(); require('./services/postgresql.service').query('SELECT 1').then(() => console.log('PG OK'))"
node -e "require('dotenv').config(); require('./services/mssql.service').query('SELECT 1').then(() => console.log('MSSQL OK'))"
```

---

## 📝 Versiyon Notları

| Versiyon | Tarih | Değişiklikler |
|----------|-------|---------------|
| 1.0.0 | - | İlk sürüm |
| 1.1.0 | - | Fotoğraf senkronizasyonu eklendi |
| 1.2.0 | - | Stok XML desteği eklendi |

---

## 📞 Destek

Sorularınız için:
- Log dosyalarını inceleyin
- Bu dokümandaki sorun giderme adımlarını takip edin
- Gerekirse detaylı hata mesajını not edin

---

*Son Güncelleme: 2026-01-10*
