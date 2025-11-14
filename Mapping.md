# AlanEslesmesi_Satis_Baslik

| Web Tablo   | Web Alan               | ERP Tablo              | ERP Alan                                                    | Not                                                                             |
|:------------|:-----------------------|:-----------------------|:------------------------------------------------------------|:--------------------------------------------------------------------------------|
| satislar    | satis_tarihi           | CARI_HESAP_HAREKETLERI | cha_tarihi; cha_belge_tarih                                 | Trace'e göre ikisi aynı tarih.                                                  |
| satislar    | fatura_sira_no         | CARI_HESAP_HAREKETLERI | cha_evrakno_sira                                            | nan                                                                             |
| satislar    | fatura_seri_no         | CARI_HESAP_HAREKETLERI | cha_evrakno_seri                                            | nan                                                                             |
| satislar    | cari_hesap_id -> (kod) | CARI_HESAP_HAREKETLERI | cha_kod                                                     | INT_KodMap_Cari ile lookup.                                                     |
| satislar    | toplam_tutar           | CARI_HESAP_HAREKETLERI | cha_meblag                                                  | Trace örneğinde eşit.                                                           |
| satislar    | ara_toplam             | CARI_HESAP_HAREKETLERI | cha_aratoplam                                               | nan                                                                             |
| satislar    | notlar                 | CARI_HESAP_HAREKETLERI | cha_aciklama                                                | nan                                                                             |
| satislar    | odeme_sekli            | CARI_HESAP_HAREKETLERI | cha_tpoz; cha_cari_cins                                     | Sadece veresiye ise başlık yazılır (cha_tpoz=0; cari_cins=0). Peşinde yazılmaz. |
| satislar    | indirim_tutari         | CARI_HESAP_HAREKETLERI | cha_ft_iskonto1                                             | nan                                                                             |
| satislar    | indirim_tutari2        | CARI_HESAP_HAREKETLERI | cha_ft_iskonto2                                             | nan                                                                             |
| satislar    | indirim_tutari3        | CARI_HESAP_HAREKETLERI | cha_ft_iskonto3                                             | nan                                                                             |
| satislar    | indirim_tutari4        | CARI_HESAP_HAREKETLERI | cha_ft_iskonto4                                             | nan                                                                             |
| satislar    | indirim_tutari5        | CARI_HESAP_HAREKETLERI | cha_ft_iskonto5                                             | nan                                                                             |
| satislar    | indirim_tutari6        | CARI_HESAP_HAREKETLERI | cha_ft_iskonto6                                             | nan                                                                             |
| (otomatik)  | (—)                    | CARI_HESAP_HAREKETLERI | cha_evrak_tip=63; cha_tip=0; cha_cinsi=6; cha_normal_iade=0 | Satış faturası (normal).                                                        |

# AlanEslesmesi_Satis_Satir

| Web Tablo       | Web Alan               | ERP Tablo              | ERP Alan                                                 | Not                                           |
|:----------------|:-----------------------|:-----------------------|:---------------------------------------------------------|:----------------------------------------------|
| satis_kalemleri | satis_id -> (başlık)   | STOK_HAREKETLERI       | sth_fat_recid_recno                                      | Başlıktaki cha_RECno'ya bağlanır (SP içinde). |
| satis_kalemleri | stok_id -> (stok_kod)  | STOK_HAREKETLERI       | sth_stok_kod                                             | INT_KodMap_Stok ile lookup.                   |
| satis_kalemleri | miktar                 | STOK_HAREKETLERI       | sth_miktar                                               | nan                                           |
| satis_kalemleri | indirim_tutari         | STOK_HAREKETLERI       | sth_iskonto1                                             | nan                                           |
| satis_kalemleri | indirim_tutari2        | STOK_HAREKETLERI       | sth_iskonto2                                             | nan                                           |
| satis_kalemleri | indirim_tutari3        | STOK_HAREKETLERI       | sth_iskonto3                                             | nan                                           |
| satis_kalemleri | indirim_tutari4        | STOK_HAREKETLERI       | sth_iskonto4                                             | nan                                           |
| satis_kalemleri | indirim_tutari5        | STOK_HAREKETLERI       | sth_iskonto5                                             | nan                                           |
| satis_kalemleri | indirim_tutari6        | STOK_HAREKETLERI       | sth_iskonto6                                             | nan                                           |
| satis_kalemleri | toplam_tutar           | STOK_HAREKETLERI       | sth_tutar                                                | nan                                           |
| satis_kalemleri | kdv_tutari             | STOK_HAREKETLERI       | sth_vergi                                                | nan                                           |
| satis_kalemleri | kdv_orani -> (pointer) | STOK_HAREKETLERI       | sth_vergi_pntr                                           | INT_KdvPointerMap: oran→pntr.                 |
| satislar        | satis_tarihi           | STOK_HAREKETLERI       | sth_tarih; sth_belge_tarih                               | nan                                           |
| satislar        | cari_hesap_id -> (kod) | STOK_HAREKETLERI       | sth_cari_kodu                                            | Cari kod ile uyumlu olmalı.                   |
| konfig          | depo_cikis             | STOK_HAREKETLERI       | sth_cikis_depo_no                                        | INT_DepoMap'ten alınır.                       |
| konfig          | depo_giris             | STOK_HAREKETLERI       | sth_giris_depo_no                                        | Gerekirse; satışta genellikle çıkış depo.     |
| (otomatik)      | (—)                    | STOK_HAREKETLERI       | sth_tip=1; sth_cins=0; sth_normal_iade=0; sth_evraktip=4 | Satış stok çıkışı.                            |
| satislar        | fatura_sira_no         | CARI_HESAP_HAREKETLERI | sth_evrakno_sira                                         | nan                                           |
| satislar        | fatura_seri_no         | CARI_HESAP_HAREKETLERI | sth_evrakno_seri                                         | nan                                           |

# AlanEslesmesi_Tahsilat

| Web Tablo   | Web Alan                                                                                 | ERP Tablo                               | ERP Alan                                                                    | Not                                                                                             |
|:------------|:-----------------------------------------------------------------------------------------|:----------------------------------------|:----------------------------------------------------------------------------|:------------------------------------------------------------------------------------------------|
| tahsilatlar | tahsilat_tarihi                                                                          | CARI_HESAP_HAREKETLERI                  | cha_tarihi; cha_belge_tarih                                                 | nan                                                                                             |
| tahsilatlar | cari_hesap_id -> (kod)                                                                   | CARI_HESAP_HAREKETLERI                  | cha_kod                                                                     | INT_KodMap_Cari ile lookup.                                                                     |
| tahsilatlar | tutar                                                                                    | CARI_HESAP_HAREKETLERI                  | cha_meblag; cha_aratoplam                                                   | nan                                                                                             |
| tahsilatlar | aciklama                                                                                 | CARI_HESAP_HAREKETLERI                  | cha_aciklama                                                                | nan                                                                                             |
| tahsilatlar | tahsilat_tipi='nakit'                                                                    | CARI_HESAP_HAREKETLERI                  | cha_tpoz=1; cha_cari_cins=4; cha_kod=<kasa_kodu>                            | Kasadan kapanış. Kasa kodu INT_KodMap_Kasa'dan.                                                 |
| tahsilatlar | tahsilat_tipi in ('kredi_karti','havale')                                                | CARI_HESAP_HAREKETLERI                  | cha_tpoz=1; cha_cari_cins=2; cha_kod=<banka_kodu>                           | Bankadan kapanış. Banka kodu INT_KodMap_Banka'dan.                                              |
| tahsilatlar | tahsilatlar.cek_no / tahsilatlar.banka_adi / tahsilatlar.sube_adi / tahsilatlar.hesap_no | CARI_HESAP_HAREKETLERI / ODEME_EMIRLERI | cha_aciklama / sck_no, sck_banka_adres1, sck_sube_adres2, sck_hesapno_sehir | Web→ERP (çek tahsilatı):                                                                        |
|             |                                                                                          |                                         |                                                                             |   cha_aciklama = '/' + cek_no + '/' + banka_adi + '/' + sube_adi + '/' + hesap_no               |
|             |                                                                                          |                                         |                                                                             |   (NULL gelen alanları boş string kabul et; sondaki '/' işareti hesap_no boşsa da kalabilir.)   |
|             |                                                                                          |                                         |                                                                             |                                                                                                 |
|             |                                                                                          |                                         |                                                                             | ERP→Web (çek tahsilatı):                                                                        |
|             |                                                                                          |                                         |                                                                             |   1) cha_aciklama değerini '/' karakterine göre parçala.                                        |
|             |                                                                                          |                                         |                                                                             |   2) Parçalar: ['', cek_no, banka_adi, sube_adi, hesap_no] şeklindedir.                         |
|             |                                                                                          |                                         |                                                                             |   3) cek_no = parça[1], banka_adi = parça[2], sube_adi = parça[3], hesap_no = parça[4] (varsa). |
|             |                                                                                          |                                         |                                                                             |                                                                                                 |
|             |                                                                                          |                                         |                                                                             | Senet tahsilatı için mevcut kural geçerli: cha_aciklama = 'SENET - ' + kullanıcı_notu.          |
| (konfig)    | (—)                                                                                      | CARI_HESAP_HAREKETLERI                  | cha_evrak_tip; cha_tip; cha_cinsi; cha_normal_iade                          | OdemeYeri & belge türüne göre INT_CariHareketMap'ten çek.                                       |
| tahsilatlar | tahsilat_sira_no                                                                         | CARI_HESAP_HAREKETLERI                  | cha_evrakno_sira                                                            | nan                                                                                             |
| tahsilatlar | tahsilat_seri_no                                                                         | CARI_HESAP_HAREKETLERI                  | cha_evrakno_seri                                                            | nan                                                                                             |
| tahsilatlar | notlar                                                                                   | CARI_HESAP_HAREKETLERI                  | cha_aciklama                                                                | nan                                                                                             |
| tahsilatlar | nan                                                                                      | CARI_HESAP_HAREKETLERI                  | cha_vade                                                                    | nan                                                                                             |

# INT_CariHareketMap

| WebBelgeTuru   | OdemeYeri   |   IadeMi |   cha_evrak_tip |   cha_tip |   cha_cinsi |   cha_normal_iade |   cha_tpoz |   cha_cari_cins | Aciklama                              |
|:---------------|:------------|---------:|----------------:|----------:|------------:|------------------:|-----------:|----------------:|:--------------------------------------|
| satis_fatura   | acikhesap   |        0 |              63 |         0 |           6 |                 0 |          0 |               0 | Satış Faturası (veresiye)             |
| tahsilat       | kasa        |        0 |               1 |         1 |           0 |                 0 |          1 |               4 | Nakitte kasadan kapanış (kurum ayarı) |
| tahsilat       | banka       |        0 |               1 |         1 |           0 |                 0 |          1 |               2 | Kart/Havale bankadan kapanış          |
| tahsilat       | cek         |        0 |               1 |         1 |           0 |                 0 |          1 |               0 | Çek tahsilatı (kurum şeması)          |
| tahsilat       | senet       |        0 |               1 |         1 |           0 |                 0 |          1 |               0 | Senet tahsilatı (kurum şeması)        |

# INT_StokHareketMap

| WebBelgeTuru   |   IadeMi |   sth_tip |   sth_cins |   sth_normal_iade |   sth_evraktip | Aciklama                                                                                      |
|:---------------|---------:|----------:|-----------:|------------------:|---------------:|:----------------------------------------------------------------------------------------------|
| satis_fatura   |        0 |         1 |          0 |                 0 |              4 | Satış stok çıkışı (trace'e göre kesin)                                                        |
| alis_fatura    |        0 |         0 |          0 |                 0 |              3 | Alış stok girişi (trace: sth_tip=0, sth_cins=0, sth_normal_iade=0, sth_evraktip=3)            |
| satis_iade     |        1 |         1 |          0 |                 1 |              4 | Satış iade stok girişi (varsayılan: sth_tip=1, sth_cins=0, sth_normal_iade=1, sth_evraktip=4) |
| alis_iade      |        1 |         0 |          0 |                 1 |              3 | Alış iade stok çıkışı (trace: sth_tip=0, sth_cins=0, sth_normal_iade=1, sth_evraktip=3)       |

# INT_KdvPointerMap

|   KdvOran |   VergiPntr |
|----------:|------------:|
|         0 |           0 |
|         1 |           1 |
|        10 |           2 |
|        20 |           3 |

# INT_KodMap_Cari

| web_cari_id   | erp_cari_kod   | Aciklama   |
|---------------|----------------|------------|

# INT_KodMap_Stok

| web_stok_id   | erp_stok_kod   | Aciklama   |
|---------------|----------------|------------|

# INT_KodMap_Banka

| web_banka_id   | erp_banka_kod   | Aciklama   |
|----------------|-----------------|------------|

# INT_KodMap_Kasa

| web_kasa_id   | erp_kasa_kod   | Aciklama   |
|---------------|----------------|------------|

# INT_DepoMap

| WebBelgeTuru   | Yon   |   erp_depo_no | Aciklama                   |
|:---------------|:------|--------------:|:---------------------------|
| satis_fatura   | cikis |             1 | Satış çıkış deposu örnek 1 |
| satis_fatura   | giris |           nan | Genelde boş; ihtiyaca göre |

# Notlar

| Baslik     | Icerik                                                                                      |
|:-----------|:--------------------------------------------------------------------------------------------|
| Notlar     | Oluşturulma: 2025-11-12 13:11                                                               |
| Kullanım   | Bu dosyadaki tablolar senkronizasyon konfigürasyonunu merkezi yönetmek için tasarlanmıştır. |
| Adım 1     | INT_*Map tablolarını kurumunuza göre doldurun (None olan alanlar).                          |
| Adım 2     | Kod eşleştirmelerini (Cari/Stok/Banka/Kasa) ilgili şablon tablolara girin.                  |
| Adım 3     | KDV oran→pntr haritasını güncelleyin.                                                       |
| Adım 4     | SP'leriniz map tablosundan değerleri çekerek INSERT/UPDATE yapsın.                          |
| Hatırlatma | SESSION_CONTEXT('SYNC_ORIGIN')='WEB' kullanarak tetikleyici döngülerini engelleyin.         |

# AlanEslesmesi_StokKart

| Web Tablo   | Web Alan     | ERP Tablo                  | ERP Alan            | Not                                                                                                                                                               |
|:------------|:-------------|:---------------------------|:--------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| stoklar     | id           | INT_KodMap_Stok            | web_stok_id         | Senkron için ana kimlik. STOKLAR.sto_kod ile birlikte kullanılacak.                                                                                               |
| stoklar     | stok_kodu    | STOKLAR                    | sto_kod             | Zorunlu stok kodu. ERP tarafında benzersiz olmalı.                                                                                                                |
| stoklar     | stok_adi     | STOKLAR                    | sto_isim            | Stok adı / açıklama.                                                                                                                                              |
| stoklar     | birim_turu   | STOKLAR                    | sto_birim1_ad       | Ana birim adı (adet, kg, koli vb).                                                                                                                                |
| stoklar     | alis_fiyati  | STOKLAR                    | sto_standartmaliyet | Varsa alış maliyetine ilk değer. Yoksa 0 bırakılabilir.                                                                                                           |
| stoklar     | satis_fiyati | STOKLAR                    | sto_satisfiyati     | Artık ana fiyat kaynağı urun_fiyat_listeleri tablosu. Buradaki fiyat sadece ilk açılışta default verilebilir (opsiyonel).                                         |
| stoklar     | stok_kodu    | STOK_SATIS_FIYAT_LISTELERI | sfiyat_stokkod      | Eskiden STOK_SATIS_FIYAT_LISTELERI için kullanılıyordu. Şimdi yalnızca fiyat listeleri senkronunda kullanılacak; stok kartı insert/update akışında zorunlu değil. |
| stoklar     | kategori_id  | STOKLAR                    | sto_anagrup_kod     | Kategori için ayrı kod mapping gerekir (örn. INT_KodMap_Kategori). Şimdilik Not.                                                                                  |
| stoklar     | marka_id     | STOKLAR                    | sto_marka_kodu      | Marka için ayrı kod mapping gerekir (örn. INT_KodMap_Marka).                                                                                                      |
| stoklar     | aciklama     | STOKLAR                    | sto_aciklama        | Varsa ürün açıklaması buraya yazılır.                                                                                                                             |
| stoklar     | olcu         | STOKLAR                    | sto_sektor_kodu     | ölçü                                                                                                                                                              |
| stoklar     | raf_kodu     | STOKLAR                    | sto_reyon_kodu      | reyon kodu                                                                                                                                                        |
| stoklar     | ambalaj      | STOKLAR                    | sto_ambalaj_kodu    | ambalaj                                                                                                                                                           |
| stoklar     | koliadeti    | STOKLAR                    | sto_kalkon_kodu     | koli adet                                                                                                                                                         |
| stoklar     | katalog_adi  | STOKLAR                    | sto_yabanci_isim    | katalog ismi                                                                                                                                                      |

# AlanEslesmesi_CariKart

| Web Tablo     | Web Alan      | ERP Tablo            | ERP Alan         | Not                                                                                                                                                                             |
|:--------------|:--------------|:---------------------|:-----------------|:--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| cari_hesaplar | id            | INT_KodMap_Cari      | cari_RECid_DBCno | Senkron için ana kimlik. CARI_HESAPLAR.cari_kod ile eşlenir.                                                                                                                    |
| cari_hesaplar | cari_kodu     | CARI_HESAPLAR        | cari_kod         | Zorunlu cari kodu. ERP tarafında benzersiz olmalı.                                                                                                                              |
| cari_hesaplar | cari_adi      | CARI_HESAPLAR        | cari_unvan1      | Cari adı / unvan1.                                                                                                                                                              |
| cari_hesaplar | cari_adi      | CARI_HESAPLAR        | cari_unvan2      | Kısa ad veya ikinci satır; istenirse boş bırakılabilir.                                                                                                                         |
| cari_hesaplar | telefon       | CARI_HESAPLAR        | cari_CepTel      | Birincil telefon.                                                                                                                                                               |
| cari_hesaplar | eposta        | CARI_HESAPLAR        | cari_EMail       | E-posta adresi.                                                                                                                                                                 |
| cari_hesaplar | adres         | CARI_HESAP_ADRESLERI | adr_cadde        | Temel adres satırı. CARI_HESAP_ADRESLERI tablosunda adr_adres_no=0/1 olan kayıt kullanılacak. ERP→Web senkronunda adr_cadde + mah./sokak birleştirilip web.adres'e yazılabilir. |
| cari_hesaplar | il            | CARI_HESAP_ADRESLERI | adr_il           | İl bilgisi. CARI_HESAP_ADRESLERI.adr_il                                                                                                                                         |
| cari_hesaplar | ilce          | CARI_HESAP_ADRESLERI | adr_ilce         | İlçe bilgisi. CARI_HESAP_ADRESLERI.adr_ilce                                                                                                                                     |
| cari_hesaplar | vergi_dairesi | CARI_HESAPLAR        | cari_vdaire_adi  | Vergi dairesi adı.                                                                                                                                                              |
| cari_hesaplar | vergi_no      | CARI_HESAPLAR        | cari_vdaire_no   | Vergi numarası / TC.                                                                                                                                                            |
| cari_hesaplar | posta_kodu    | CARI_HESAP_ADRESLERI | adr_posta_kodu   | Posta kodu. CARI_HESAP_ADRESLERI.adr_posta_kodu                                                                                                                                 |

# AlanEslesmesi_BarkodKart

| Web Tablo       | Web Alan               | ERP Tablo        | ERP Alan     | Not                                                                         |
|:----------------|:-----------------------|:-----------------|:-------------|:----------------------------------------------------------------------------|
| urun_barkodlari | id                     | (yok)            | (yok)        | ERP tarafında BARKOD_TANIMLARI için kimlik kullanılmaz; sadece izleme için. |
| urun_barkodlari | stok_id -> (stok_kodu) | BARKOD_TANIMLARI | bar_stokkodu | stok_id, INT_KodMap_Stok ile sto_kod'a çevrilir.                            |
| urun_barkodlari | barkod                 | BARKOD_TANIMLARI | bar_kod      | Asıl barkod değeri.                                                         |
| urun_barkodlari | barkod_tipi            | BARKOD_TANIMLARI | bar_tipi     | Standart / Koli vb. Yoksa varsayılan '1' bırakılabilir.                     |
| urun_barkodlari | aktif                  | BARKOD_TANIMLARI | bar_pasif_fl | aktif=false ise bar_pasif_fl=1 yapılabilir.                                 |

# AlanEslesmesi_Fiyat

| Web Tablo             | Web Alan                      | ERP Tablo                        | ERP Alan            | Not                                                                                                                                                                                                                                                                                                                                                                         |
|:----------------------|:------------------------------|:---------------------------------|:--------------------|:----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| urun_fiyat_listeleri  | stok_id -> (stok_kodu)        | STOK_SATIS_FIYAT_LISTELERI       | sfiyat_stokkod      | stok_id, INT_KodMap_Stok üzerinden STOKLAR.sto_kod ile eşleştirilecek.                                                                                                                                                                                                                                                                                                      |
| urun_fiyat_listeleri  | fiyat                         | STOK_SATIS_FIYAT_LISTELERI       | sfiyat_fiyati       | Satış fiyatı.                                                                                                                                                                                                                                                                                                                                                               |
| urun_fiyat_listeleri  | fiyat_tanimi_id -> (liste_no) | STOK_SATIS_FIYAT_LISTELERI       | sfiyat_listesirano  | fiyat_tanimi_id, INT_KodMap_FiyatListe.erp_liste_no ile eşleşen kayıt üzerinden bulunur.                                                                                                                                                                                                                                                                                    |
| urun_fiyat_listeleri  | baslangic_tarihi              | STOK_SATIS_FIYAT_LISTELERI       | sfiyat_bas_tarih    | Başlangıç tarihi; NULL ise boş bırakılabilir ya da 1899-12-30 gibi ERP default'u kullanılabilir.                                                                                                                                                                                                                                                                            |
| urun_fiyat_listeleri  | bitis_tarihi                  | STOK_SATIS_FIYAT_LISTELERI       | sfiyat_bit_tarih    | Bitiş tarihi; NULL ise sınırsız geçerlilik.                                                                                                                                                                                                                                                                                                                                 |
| fiyat_tanimlari       | id                            | INT_KodMap_FiyatListe            | web_fiyat_tanimi_id | Web tarafındaki fiyat_tanimlari UUID değeri. Ana kimlik.                                                                                                                                                                                                                                                                                                                    |
| fiyat_tanimlari       | fiyat_adi                     | STOK_SATIS_FIYAT_LISTE_TANIMLARI | sfl_aciklama        | ERP fiyat liste açıklaması. İlk ERP→Web senkronunda INT_KodMap_FiyatListe.web_fiyat_tanimi_id = fiyat_tanimlari.id eşleşmesi üzerinden ilgili STOK_SATIS_FIYAT_LISTE_TANIMLARI.sfl_aciklama değeri web tarafında fiyat_tanimlari.fiyat_adi alanına yazılır. Sonraki senkronlarda bağlantı INT_KodMap_FiyatListe (web_fiyat_tanimi_id, erp_liste_no) üzerinden takip edilir. |
| fiyat_tanimlari       | liste_no                      | STOK_SATIS_FIYAT_LISTE_TANIMLARI | sfl_sirano          | ERP liste numarası. İstersen web şemasına 'erp_liste_no' şeklinde ek kolon olarak aç.                                                                                                                                                                                                                                                                                       |
| INT_KodMap_FiyatListe | liste_no                      | STOK_SATIS_FIYAT_LISTE_TANIMLARI | sfl_sirano          | Mapping tablosu: her ERP liste numarası için bir satır.                                                                                                                                                                                                                                                                                                                     |
| INT_KodMap_FiyatListe | web_fiyat_tanimi_id           | fiyat_tanimlari                  | id                  | Mapping tablosu: ilgili fiyat_tanimlari kaydının UUID'si.                                                                                                                                                                                                                                                                                                                   |

# AlanEslesmesi_OdemeEmri

| Web Tablo   | Web Alan                         | ERP Tablo      | ERP Alan                                          | Not                                                                              |
|:------------|:---------------------------------|:---------------|:--------------------------------------------------|:---------------------------------------------------------------------------------|
| tahsilatlar | cek_no                           | ODEME_EMIRLERI | sck_no                                            | Çek/Senet numarası. Web tahsilatlar.cek_no alanından gelir.                      |
| tahsilatlar | banka_adi                        | ODEME_EMIRLERI | sck_banka_adres1                                  | Bankanın adı. Örn: 'ZİRAAT', 'İŞ BANKASI'.                                       |
| tahsilatlar | sube_adi                         | ODEME_EMIRLERI | sck_sube_adres2                                   | Şube adı/bilgisi. Örn: 'ANTALYA ŞB.'                                             |
| tahsilatlar | hesap_no                         | ODEME_EMIRLERI | sck_hesapno_sehir                                 | Hesap numarası veya IBAN'ın ERP tarafında tutulduğu alan.                        |
| tahsilatlar | tutar                            | ODEME_EMIRLERI | sck_tutar                                         | Çek/Senet tutarı. Tahsilat tutarı ile aynı.                                      |
| tahsilatlar | cek_vade_tarihi                  | ODEME_EMIRLERI | sck_vade                                          | Çek/Senet vadesi.                                                                |
| tahsilatlar | tahsilat_tarihi                  | ODEME_EMIRLERI | sck_duzen_tarih                                   | Düzenleme tarihi. Tahsilat işlem tarihi.                                         |
| tahsilatlar | cari_hesap_id -> (kod)           | ODEME_EMIRLERI | sck_sahip_cari_kodu                               | Çeki veren cari. INT_KodMap_Cari üzerinden cari_kod bulunur.                     |
| (konfig)    | tahsilat_tipi in ('cek','senet') | ODEME_EMIRLERI | sck_tip=0; sck_doviz=1; sck_odenen=0; sck_iptal=0 | Müşteriden alınan çek/senet. TL varsayılan. Ödeme henüz yapılmadı, sadece giriş. |

