# İnkremental Senkronizasyon Sistemi - Kullanım Kılavuzu

## 🎯 Genel Bakış

Bu sistem, ERP (MS SQL) ve Web (PostgreSQL) veritabanları arasında **artımlı (incremental)** ve **çift yönlü (bidirectional)** senkronizasyon sağlar. Her tablonun son güncelleme tarihini (`lastup_date`) takip ederek sadece değişen kayıtları aktarır.

## 📋 Özellikler

- ✅ **İnkremental Sync**: Sadece değişen kayıtları aktarır
- ✅ **Bulk Transfer**: 30k+ kayıt için optimize edilmiş toplu aktarım
- ✅ **Tarih Takibi**: Her tablo için son senkronizasyon zamanı
- ✅ **Mapping Yönetimi**: ERP-Web ID eşleştirmeleri
- ✅ **Hata Toleransı**: Tek kayıt hatası tüm işlemi durdurmaz

## 🚀 Hızlı Başlangıç

### 1. İlk Kurulum

```bash
# Sync state tablosunu oluştur
node scripts/setup_sync_state.js

# Mevcut veriler için sync state başlat
node scripts/initialize_sync_state.js
```

### 2. Fiyat Mapping Kurulumu

```bash
# Fiyat liste eşleştirmelerini oluştur
node scripts/setup_price_mappings.js
```

### 3. Veri Aktarımı

**Seçenek A: Hızlı Toplu Aktarım (Önerilen - 30k+ kayıt için)**
```bash
node scripts/fast_bulk_sync.js
```

**Seçenek B: İnkremental Aktarım**
```bash
node scripts/incremental_sync.js
```

**Seçenek C: Tam Senkronizasyon (Tüm verileri yeniden aktar)**
```bash
node scripts/incremental_sync.js --full
```

## 📊 Scriptler ve Kullanımları

### Kurulum Scriptleri

#### `setup_sync_state.js`
Sync state tablosunu oluşturur.
```bash
node scripts/setup_sync_state.js
```

#### `initialize_sync_state.js`
Mevcut veriler için sync state'i başlatır (ilk kez çalıştırılmalı).
```bash
node scripts/initialize_sync_state.js
```

#### `setup_price_mappings.js`
ERP fiyat liste numaralarını Web fiyat tanımlarıyla eşleştirir.
```bash
node scripts/setup_price_mappings.js
```

### Senkronizasyon Scriptleri

#### `fast_bulk_sync.js` ⚡ (Önerilen)
**Ne zaman kullanılır:** İlk aktarım veya büyük veri setleri (30k+ kayıt)

**Özellikler:**
- Batch processing (500 kayıt/batch)
- PostgreSQL UPSERT (INSERT ... ON CONFLICT)
- Hafıza optimizasyonu
- İlerleme göstergesi

```bash
node scripts/fast_bulk_sync.js
```

**Performans:**
- 30.000 kayıt: ~30-60 saniye
- 100.000 kayıt: ~2-3 dakika

#### `incremental_sync.js`
**Ne zaman kullanılır:** Günlük/saatlik senkronizasyon

**Özellikler:**
- Sadece değişen kayıtları aktarır
- Sync state otomatik güncellenir
- Detaylı raporlama

```bash
# Normal incremental sync
node scripts/incremental_sync.js

# Tam senkronizasyon (sync state sıfırla)
node scripts/incremental_sync.js --full
```

### Yardımcı Scriptler

#### `check_transfer_results.js`
Aktarım sonuçlarını kontrol eder.
```bash
node scripts/check_transfer_results.js
```

#### `check_fiyat_mapping.js`
Fiyat mapping durumunu gösterir.
```bash
node scripts/check_fiyat_mapping.js
```

## 🔧 Konfigürasyon

### .env Dosyası

```env
# Batch Size (varsayılan: 500)
BATCH_SIZE=500

# Sync Interval (ms)
SYNC_INTERVAL_MS=300000

# Log Level
LOG_LEVEL=info
```

## 📅 Tarih Alanları Mapping

| Tablo | ERP Alanı | Web Alanı |
|-------|-----------|-----------|
| STOKLAR | `sto_lastup_date` | `guncelleme_tarihi` |
| STOK_SATIS_FIYAT_LISTELERI | `sfiyat_lastup_date` | `guncelleme_tarihi` |
| CARI_HESAPLAR | `cari_lastup_date` | `guncelleme_tarihi` |
| CARI_HESAP_HAREKETLERI | `cha_lastup_date` | `guncelleme_tarihi` |

## 🔄 Senkronizasyon Akışı

```
1. Sync State Kontrolü
   ↓
2. Son Senkronizasyon Zamanını Al
   ↓
3. Değişen Kayıtları Sorgula (WHERE lastup_date > son_zaman)
   ↓
4. Batch İşleme
   ↓
5. UPSERT (INSERT ... ON CONFLICT)
   ↓
6. Sync State Güncelle
```

## 💡 En İyi Pratikler

### 1. İlk Kurulum
```bash
# 1. Sync state oluştur
node scripts/setup_sync_state.js

# 2. Mevcut verileri işaretle
node scripts/initialize_sync_state.js

# 3. Fiyat mappingleri kur
node scripts/setup_price_mappings.js

# 4. İlk tam aktarım
node scripts/fast_bulk_sync.js
```

### 2. Günlük Kullanım
```bash
# Her gün/saat çalıştır (sadece değişenler)
node scripts/incremental_sync.js
```

### 3. Sorun Giderme
```bash
# Sync durumunu kontrol et
node scripts/check_transfer_results.js

# Mapping kontrolü
node scripts/check_fiyat_mapping.js

# Tam yeniden senkronizasyon
node scripts/incremental_sync.js --full
```

## ⚠️ Önemli Notlar

### Performans
- **Bulk sync** kullanın: 30k+ kayıt için 10-20x daha hızlı
- **Batch size** ayarlayın: Hafıza/hız dengesi için `.env` dosyasında
- **İndeksler** ekleyin: `lastup_date` alanlarına

### Veri Bütünlüğü
- İlk çalıştırmada `initialize_sync_state.js` mutlaka çalıştırılmalı
- Mapping tabloları dolu olmalı (özellikle `int_kodmap_fiyat_liste`)
- Saat senkronizasyonu: ERP ve Web sunucuları aynı saat diliminde olmalı

### Hata Yönetimi
- Tek kayıt hatası tüm batch'i durdurmaz
- Hatalar loglara yazılır
- Sync state sadece başarılı kayıtlar için güncellenir

## 🐛 Sorun Giderme

### "Fiyat mapping bulunamadı" Uyarısı
```bash
# Çözüm: Fiyat mappingleri oluştur
node scripts/setup_price_mappings.js
```

### Tüm Kayıtlar Tekrar Aktarılıyor
```bash
# Çözüm: Sync state'i başlat
node scripts/initialize_sync_state.js
```

### Yavaş Performans
```bash
# Çözüm: Bulk sync kullan
node scripts/fast_bulk_sync.js

# veya batch size artır (.env)
BATCH_SIZE=1000
```

## 📞 Destek

Sorunlar için:
1. Logları kontrol edin (`logs/app.log`)
2. Sync state durumunu kontrol edin
3. Mapping tablolarını kontrol edin
