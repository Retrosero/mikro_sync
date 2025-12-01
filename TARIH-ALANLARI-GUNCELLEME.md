# TARİH ALANLARI VE İLİŞKİ GÜNCELLEMESİ

**Tarih:** 1 Aralık 2025  
**Konu:** Web → ERP Senkronizasyonunda Tarih Alanları ve İlişki Düzeltmeleri

---

## 📋 YAPILAN DEĞİŞİKLİKLER

### 1. Tarih Formatı Fonksiyonu Eklendi

**Dosya:** `transformers/satis.transformer.js`

```javascript
// Tarih formatını MSSQL için dönüştür (YYYY-MM-DD HH:MM:SS.mmm)
function formatDateForMSSQL(date) {
  if (!date) return null;
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const milliseconds = String(d.getMilliseconds()).padStart(3, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}
```

**Açıklama:** PostgreSQL'den gelen JavaScript Date objelerini MSSQL'in beklediği formata (`2025-12-01 12:03:16.123`) dönüştürür.

---

### 2. Cari Hesap Hareketleri - Tarih Alanları

**Dosya:** `transformers/satis.transformer.js`

**Eklenen Alanlar:**
```javascript
cha_create_date: formatDateForMSSQL(webSatis.olusturma_tarihi),
cha_lastup_date: formatDateForMSSQL(webSatis.guncelleme_tarihi)
```

**Dosya:** `sync-jobs/satis.processor.js`

**INSERT Sorgusuna Eklendi:**
```sql
cha_create_user, cha_lastup_user, cha_create_date, cha_lastup_date,
...
@cha_create_user, @cha_lastup_user, @cha_create_date, @cha_lastup_date,
```

---

### 3. Stok Hareketleri - Tarih Alanları

**Dosya:** `transformers/satis.transformer.js`

**Eklenen Alanlar:**
```javascript
sth_create_date: formatDateForMSSQL(webKalem.olusturma_tarihi || webSatis.olusturma_tarihi),
sth_lastup_date: formatDateForMSSQL(webKalem.guncelleme_tarihi || webSatis.guncelleme_tarihi)
```

**Dosya:** `sync-jobs/satis.processor.js`

**INSERT Sorgusuna Eklendi:**
```sql
sth_create_user, sth_lastup_user, sth_create_date, sth_lastup_date,
...
@sth_create_user, @sth_lastup_user, @sth_create_date, @sth_lastup_date,
```

---

### 4. İlişki Düzeltmesi - sth_fat_recid_recno

**Dosya:** `sync-jobs/satis.processor.js`

**Sıralama:**
1. ✅ Önce `CARI_HESAP_HAREKETLERI` kaydı oluşturulur
2. ✅ Dönen `cha_RECno` değeri alınır
3. ✅ `STOK_HAREKETLERI` kaydı oluşturulurken `sth_fat_recid_recno` alanına yazılır

**Kod:**
```javascript
// 2. Sadece veresiye satışlarda başlık yaz
let chaRecno = null;
if (webSatis.odeme_sekli === 'veresiye' || webSatis.odeme_sekli === 'acikhesap') {
  // CARI_HESAP_HAREKETLERI'ne ekle
  chaRecno = await this.insertCariHareket(baslikData, transaction);
  
  // RECid_RECno güncelle
  await mssqlService.updateRecIdRecNo('CARI_HESAP_HAREKETLERI', 'cha_RECno', chaRecno, transaction);
}

// 3. Satır verilerini yaz
for (const kalem of kalemler) {
  // ...
  // STOK_HAREKETLERI'ne ekle
  const sthRecno = await this.insertStokHareket(satirData, chaRecno, transaction);
  // ...
}
```

---

## ✅ SONUÇ

### Düzeltilen Sorunlar:

1. ✅ **Tarih Alanları NULL Sorunu Çözüldü**
   - `cha_create_date` ve `cha_lastup_date` artık web'deki tarihlerle doluyor
   - `sth_create_date` ve `sth_lastup_date` artık web'deki tarihlerle doluyor
   - Tarih formatı MSSQL'e uygun: `YYYY-MM-DD HH:MM:SS.mmm`

2. ✅ **İlişki Sıralaması Düzeltildi**
   - Önce cari hareket oluşturuluyor
   - Sonra stok hareketi oluşturulurken `sth_fat_recid_recno` alanına cari hareket ID'si yazılıyor

3. ✅ **Veri Bütünlüğü Sağlandı**
   - Web'deki oluşturma ve güncelleme tarihleri ERP'ye aktarılıyor
   - Cari ve stok hareketleri arasındaki ilişki korunuyor

---

## 📝 NOTLAR

- ⚠️ MSSQL veritabanına hiçbir değişiklik yapılmadı
- ✅ Sadece web tarafındaki kod güncellendi
- ✅ Tarih formatı MSSQL'in beklediği formata uygun
- ✅ İlişkiler doğru sırayla oluşturuluyor

---

## 🔄 SONRAKİ ADIMLAR

1. Test ortamında senkronizasyon testi yapılmalı
2. Tarih alanlarının doğru doldurulduğu kontrol edilmeli
3. `sth_fat_recid_recno` ilişkisinin doğru çalıştığı doğrulanmalı
4. Production'a geçiş yapılabilir

---

**Güncelleme Tamamlandı:** ✅
