# ERP - Web Senkronizasyon Mapping Master Dökümanı

Bu döküman, Mikro ERP ile Web (PostgreSQL) arasındaki tüm alan eşleşmelerini, iş kurallarını ve senkronizasyon mantığını içeren tek ve kapsamlı kaynaktır.

## 1. Satış İşlemleri (Web → ERP)

### 1.1 Satış Başlık (AlanEslesmesi_Satis_Baslik)
**Web Tablo:** `satislar` | **ERP Tablo:** `CARI_HESAP_HAREKETLERI`

| Web Alan | ERP Alan | Tip / Mantık | Not |
| :--- | :--- | :--- | :--- |
| `satis_tarihi` | `cha_tarihi` | `YYYY-MM-DD 00:00:00.000` | Fatura tarihi |
| `satis_tarihi` | `cha_belge_tarih` | `YYYY-MM-DD 00:00:00.000` | Belge tarihi |
| `fatura_seri_no` | `cha_evrakno_seri` | `string(10)` | Fatura seri (Örn: 'A') |
| `fatura_sira_no` | `cha_evrakno_sira` | `integer` | Sıra no (Otomatik artan) |
| `belge_no` | `cha_belge_no` | `string(20)` | Varsa belge numarası |
| `cari_hesap_id` | `cha_kod` | `lookup` | `int_kodmap_cari` üzerinden ERP Kodu |
| `cari_hesap_id` | `cha_ciro_cari_kodu` | `lookup` | Peşin işlemlerde müşteri kodu buraya |
| `toplam_tutar` | `cha_meblag` | `float` | Toplam ödenecek tutar |
| `ara_toplam` | `cha_aratoplam` | `float` | Matrah (KDV hariç) |
| `notlar` | `cha_aciklama` | `string(50)` | Başlık açıklaması |
| `odeme_sekli` | `cha_tpoz` | `mapped` | `vadeli` -> 0, `pesin/kart` -> 1 |
| `odeme_sekli` | `cha_cari_cins` | `mapped` | 0 (Cari), 2 (Banka), 4 (Kasa) |
| `odeme_sekli` | `cha_grupno` | `mapped` | `vadeli` -> 0, `diğer` -> 1 |
| `iskonto1-6` | `cha_ft_iskonto1-6` | `float` | Fatura altı iskontolar |
| `(otomatik)` | `cha_evrak_tip` | 63 | Satış Faturası |
| `(otomatik)` | `cha_tip` | 0 | Borç |
| `(otomatik)` | `cha_cinsi` | 6 | Fatura |
| `satis_tipi` | `cha_normal_Iade` | `boolean` | 'iade' ise 1, değilse 0 |

### 1.2 Satış Satırları (AlanEslesmesi_Satis_Satir)
**Web Tablo:** `satis_kalemleri` | **ERP Tablo:** `STOK_HAREKETLERI`

| Web Alan | ERP Alan | Tip / Mantık | Not |
| :--- | :--- | :--- | :--- |
| `stok_id` | `sth_stok_kod` | `lookup` | `int_kodmap_stok` üzerinden ERP Kodu |
| `miktar` | `sth_miktar` | `float` | Satılan miktar |
| `toplam_tutar` | `sth_tutar` | `float` | Satır brüt tutarı |
| `kdv_tutari` | `sth_vergi` | `float` | Satır KDV tutarı |
| `kdv_orani` | `sth_vergi_pntr` | `lookup` | `int_kdvpointermap` üzerinden |
| `iskonto1-6` | `sth_iskonto1-6` | `float` | Satır iskontoları |
| `notlar` | `sth_aciklama` | `string(255)` | Kalem açıklaması |
| `(otomatik)` | `sth_evraktip` | 4 | Satış Faturası Stok |
| `(otomatik)` | `sth_tip` | 1 | Çıkış |
| `(otomatik)` | `sth_cins` | 0 | Stok |
| `(otomatik)` | `sth_cikis_depo_no`| 1 | Varsayılan Çıkış Deposu |
| `(otomatik)` | `sth_fiyat_liste_no`| 1 | Varsayılan Fiyat Listesi |

---

## 2. Tahsilat İşlemleri (Web → ERP)

### 2.1 Tahsilat Başlık (AlanEslesmesi_Tahsilat)
**Web Tablo:** `tahsilatlar` | **ERP Tablo:** `CARI_HESAP_HAREKETLERI`

| Web Alan | ERP Alan | Tip / Mantık | Not |
| :--- | :--- | :--- | :--- |
| `tahsilat_tarihi` | `cha_tarihi` | `YYYY-MM-DD` | İşlem tarihi |
| `tutar` | `cha_meblag` | `float` | Tahsilat tutarı |
| `cari_hesap_id` | `cha_kod` | `lookup` | Müşteri Cari Kodu |
| `vade_tarihi` | `cha_vade` | `integer` | `YYYYMMDD` (Örn: 20260321) |
| `tahsilat_tipi` | `cha_cinsi` | `mapped` | Tip detaylarına bakınız (Bölüm 2.2) |
| `banka_id / kasa_id`| `cha_kasa_hizkod` | `lookup` | Kasa/Banka ERP Kodu |
| `tahsilat_tipi` | `cha_kasa_hizmet` | `mapped` | 2 (Banka), 4 (Kasa) |
| `(otomatik)` | `cha_evrak_tip` | 1 | Makbuz / Fiş |
| `(otomatik)` | `cha_tip` | 1 | Alacak |

### 2.2 Tahsilat Tipi Detayları
| Web `tahsilat_tipi` | `cha_cinsi` | `cha_kasa_hizmet` | `cha_kasa_hizkod` | `cha_sntck_poz` |
| :--- | :--- | :--- | :--- | :--- |
| `nakit` | 0 | 4 | Kasa ERP Kodu | 0 |
| `cek` | 1 | 4 | 'ÇEK' | 0 |
| `senet` | 2 | 4 | 'SENET' | 0 |
| `havale` | 17 | 2 | Banka ERP Kodu | 2 |
| `kredi_karti` | 19 | 2 | Banka ERP Kodu | 2 |

---

## 3. Kart Bilgileri (Senkronizasyon)

### 3.1 Stok Kartları (AlanEslesmesi_StokKart)
**Web:** `stoklar` | **ERP:** `STOKLAR`

| Web Alan | ERP Alan | Mantık |
| :--- | :--- | :--- |
| `stok_kodu` | `sto_kod` | Birincil Anahtar |
| `stok_adi` | `sto_isim` | Ürün Adı |
| `birim_turu` | `sto_birim1_ad` | Adet, KG, Koli vb. |
| `alis_fiyati` | `sto_standartmaliyet`| |
| `kategori_id` | `sto_anagrup_kod` | |
| `marka_id` | `sto_marka_kodu` | |
| `raf_kodu` | `sto_reyon_kodu` | |
| `katalog_ismi` | `sto_yabanci_isim` | |

### 3.2 Cari Kartlar (AlanEslesmesi_CariKart)
**Web:** `cari_hesaplar` | **ERP:** `CARI_HESAPLAR`

| Web Alan | ERP Alan | Mantık |
| :--- | :--- | :--- |
| `cari_kodu` | `cari_kod` | Birincil Anahtar |
| `cari_adi` | `cari_unvan1` | Unvan 1 |
| `telefon` | `cari_CepTel` | Cep Telefonu |
| `eposta` | `cari_EMail` | E-Posta |
| `vergi_no` | `cari_vdaire_no` | Vergi No / TC |
| `vergi_dairesi` | `cari_vdaire_adi` | |
| `adres` | `adr_cadde` | `CARI_HESAP_ADRESLERI` (adr_adres_no=0) |

### 3.3 Barkodlar (AlanEslesmesi_BarkodKart)
**Web:** `urun_barkodlari` | **ERP:** `BARKOD_TANIMLARI`

| Web Alan | ERP Alan | Mantık |
| :--- | :--- | :--- |
| `barkod` | `bar_kodu` | Barkod Değeri |
| `stok_id` | `bar_stokkodu` | `int_kodmap_stok` -> ERP Kod |
| `barkod_tipi` | `bar_barkodtipi` | `ana`->0, `koli`->2, `palet`->3 |
| `aktif` | `bar_iptal` | `true` -> 0, `false` -> 1 |

---

## 4. Fiyat ve Ödeme Emirleri

### 4.1 Fiyat Listeleri (AlanEslesmesi_Fiyat)
**Web:** `urun_fiyat_listeleri` | **ERP:** `STOK_SATIS_FIYAT_LISTELERI`

| Web Alan | ERP Alan | Not |
| :--- | :--- | :--- |
| `stok_id` | `sfiyat_stokkod` | ERP Stok Kodu |
| `fiyat` | `sfiyat_fiyati` | |
| `fiyat_tanimi_id` | `sfiyat_listesirano`| `int_kodmap_fiyat_liste` lookup |
| `baslangic_tarihi`| `sfiyat_bas_tarih` | |

### 4.2 Ödeme Emirleri (AlanEslesmesi_OdemeEmri)
**Web:** `tahsilatlar` | **ERP:** `ODEME_EMIRLERI`

| Web Alan | ERP Alan | Mantık |
| :--- | :--- | :--- |
| `cek_no` | `sck_no` | Çek/Senet Numarası |
| `tutar` | `sck_tutar` | |
| `vade_tarihi` | `sck_vade` | Vade |
| `banka_adi` | `sck_banka_adres1` | |
| `sube_adi` | `sck_sube_adres2` | |
| `(otomatik)` | `sck_tip` | 0 (Çek), 1 (Senet), 4 (Havale), 6 (KK) |
| `(otomatik)` | `sck_sonpoz` | 0 (Portföyde) |

---

## 5. Sabit Eşleşme Tabloları (Internal Lookup Maps)

### 5.1 KDV Pointer (INT_KdvPointerMap)
| KdvOran | VergiPntr |
| :--- | :--- |
| 0 | 0 |
| 1 | 1 |
| 10 | 2 |
| 20 | 3 |

### 5.2 Stok Hareket Tipleri (INT_StokHareketMap)
| WebBelgeTuru | IadeMi | sth_tip | sth_cins | sth_normal_iade | sth_evraktip |
| :--- | :--- | :--- | :--- | :--- | :--- |
| satis_fatura | 0 | 1 | 0 | 0 | 4 |
| alis_fatura | 0 | 0 | 0 | 0 | 3 |
| satis_iade | 1 | 1 | 0 | 1 | 4 |

### 5.3 Cari Hareket Haritası (INT_CariHareketMap)
| WebBelgeTuru | OdemeYeri | IadeMi | cha_evrak_tip | cha_tip | cha_cinsi | cha_tpoz | cha_cari_cins | Aciklama |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| satis_fatura | acikhesap | 0 | 63 | 0 | 6 | 0 | 0 | Satış Faturası (veresiye) |
| tahsilat | kasa | 0 | - | - | - | 1 | 4 | Nakitte kasadan kapanış |
| tahsilat | banka | 0 | - | - | - | 1 | 2 | Kart/Havale bankadan kapanış |
| tahsilat | cek | 0 | - | - | - | 1 | 0 | Çek tahsilatı |
| tahsilat | senet | 0 | - | - | - | 1 | 0 | Senet tahsilatı |

---

## 6. Önemli Notlar ve Formatlar

### 6.1 Özel Açıklama Formatları (cha_aciklama)
* **Çek İşlemleri:** `/ÇekNo/Banka/Şube/HesapNo/` şeklinde parse edilir.
* **Senet İşlemleri:** `//Adres//Şehir` formatında tutulur.

### 6.2 Peşin Satış Mantığı
Peşin satışlarda (Nakit, Kredi Kartı vb.) Mikro standartlarına göre fatura başlığı (`CARI_HESAP_HAREKETLERI`) yazılmaz, sadece tahsilat fişi kesilir. Ancak cari takibi isteniyorsa `cha_tpoz=1` ile başlık yazılabilir.

### 6.3 Döngü Engelleme (Trigger Loop Prevention)
Tetikleyicilerde sonsuz döngüyü engellemek için `SESSION_CONTEXT('SYNC_ORIGIN') = 'WEB'` kontrolü kullanılır.

---
*Son Güncelleme: 2026-03-21*
*Bu dosya senkronizasyon yazılımı için tek doğruluk kaynağıdır.*
