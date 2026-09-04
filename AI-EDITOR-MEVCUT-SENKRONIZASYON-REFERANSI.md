# AI Editor Icin Mevcut Senkronizasyon Sistemi Referansi

Bu dokuman, bu repodaki mevcut senkronizasyon uygulamasinin bugun gercekte nasil calistigini AI editor veya AI ajana anlatmak icin hazirlanmistir. Bu bir yeni mimari oneri degildir. Amac, kodu degistirecek bir ajan once sistemi dogru okusun, verinin nereden geldigini, nereye yazildigini, hangi tablolara dokunmadigini ve hangi kurallari korumasi gerektigini net anlasin.

Bu dokumanin kaynagi dogrudan mevcut implementasyondur. Ozellikle su dosyalar baz alinmistir:

- `services/sync.service.js`
- `services/sync-queue-worker.js`
- `sync-jobs/*.processor.js`
- `transformers/*.transformer.js`
- `mappings/lookup-tables.js`

## 1. Sistem Ozeti

Sistem tek bir veritabani ile calismaz. Ayni servis dongusu icinde birden fazla veri kaynagi ve hedefi vardir:

- `PostgreSQL`: Web/sunucu veritabani. `sync_queue`, `sync_logs`, `sync_state`, `satislar`, `tahsilatlar`, `stoklar`, `cari_hesaplar` ve diger web tablolarini barindirir.
- `MS SQL / Mikro ERP`: ERP veritabani. `CARI_HESAP_HAREKETLERI`, `STOK_HAREKETLERI`, `STOKLAR`, `CARI_HESAPLAR`, `BARKOD_TANIMLARI`, `STOK_SATIS_FIYAT_LISTELERI` ve diger Mikro tablolarini barindirir.
- `SQLite`: Entegra ile ilgili yerel veritabani. `product`, `product_quantity`, `product_description`, `product_prices`, `pictures` gibi tablolari barindirir.

Sistemin ana amaci iki yonlu veri hareketidir:

- `Web/Sunucu -> Mikro ERP`
- `Mikro ERP -> Web/Sunucu`

Ama bunun yaninda ayni dongude su yardimci akislar da vardir:

- `ERP -> PostgreSQL kategori senkronizasyonu`
- `ERP -> PostgreSQL eldeki miktar senkronizasyonu`
- `ERP + Entegra fotograflari -> XML dosyasi + PostgreSQL xmlurunler`
- `PostgreSQL queue -> SQLite Entegra tablolari`

## 2. Ana Calisma Dongusu

`services/sync.service.js` dosyasindaki ana dongu su sirayla calisir:

1. `webToErpWorker.processQueue()`
   PostgreSQL `sync_queue` kayitlarini isler.
2. `processMSSQLQueue()`
   MS SQL `SYNC_QUEUE` kayitlarini isler.
3. `categorySyncService.syncCategories()`
   ERP kategori tablolarini web kategorilerine yazar.
4. `invoiceSettingsService.syncInvoiceNumbers()`
   Evrak sira numarasi ile ilgili destek islemleri yapar.
5. `entegraSync.runSync({ disconnect: false })`
   SQLite -> Web yonlu Entegra senkronizasyonunu calistirir.
6. `asortiSync.runAsortiSync()`
   Asorti urunlerle ilgili yardimci senkronizasyon yapar.
7. `eldekiMiktarProcessor.syncToWeb()`
   ERP eldeki miktar view bilgisini PostgreSQL `stoklar` tablosuna yazar.
8. `stockXmlService.checkAndRun()`
   ERP stoklarini ve Entegra fotograflarini XML'e ve `xmlurunler` tablosuna yazar.

Bu nedenle sistem sadece "web ile ERP arasi queue" degildir; ayni servis icinde birden fazla alt sistem vardir.

## 3. Veri Kaynaklari ve Hedefleri Matrisi

| Akis | Yon | Kaynak servis | Kaynak tablo | Ara kuyruk / mapping | Hedef tablo | Islem tipi | Not |
|---|---|---|---|---|---|---|---|
| `satis` | Web -> ERP | PostgreSQL | `satislar`, `satis_kalemleri`, yardimci olarak `cari_hesap_hareketleri` | `sync_queue`, `int_satis_mapping`, `int_kodmap_*` | `CARI_HESAP_HAREKETLERI`, `STOK_HAREKETLERI` | insert | Tek transaction, duplicate kontrolu var |
| `tahsilat` | Web -> ERP | PostgreSQL | `tahsilatlar` | `sync_queue` | `CARI_HESAP_HAREKETLERI`, bazi tiplerde `ODEME_EMIRLERI` | insert | Cek/senet/havale/kredi karti once odeme emri olusturur |
| `alis` | Web -> ERP | PostgreSQL | `alislar`, `alis_kalemleri` | `sync_queue`, `int_alis_mapping`, `int_kodmap_stok` | `CARI_HESAP_HAREKETLERI`, `STOK_HAREKETLERI`, gerekirse `STOKLAR` | insert | Stok ERP'de yoksa once stok olusturabilir |
| `iade` | Web -> ERP | PostgreSQL | `iadeler`, `iade_kalemleri` | `sync_queue`, `int_iade_mapping` | `CARI_HESAP_HAREKETLERI`, `STOK_HAREKETLERI` | insert | Satisa benzer, farkli hareket tipleri kullanir |
| `stok` | Web -> ERP | PostgreSQL | `stoklar` | `sync_queue` | `STOKLAR`, `STOK_SATIS_FIYAT_LISTELERI` | insert/update | Asorti urunler ERP'de atlanabilir |
| `barkod` | Web -> ERP | PostgreSQL | `urun_barkodlari` | `sync_queue`, `int_kodmap_stok` | `BARKOD_TANIMLARI` | insert/update/delete | DELETE icin ERP'den barkod silme yolu var |
| `cari` | Web -> ERP | PostgreSQL | `cari_hesaplar` | `sync_queue` | `CARI_HESAPLAR` | insert/update | `cari_kod` ile arama yapar |
| `stok_hareket` | Web -> ERP | PostgreSQL | `stok_hareketleri` | `sync_queue` | `STOK_HAREKETLERI`, bazi durumlarda `SAYIM_SONUCLARI` | insert | Eski logic korunmus |
| `cari_hareket` | Web -> ERP | PostgreSQL | `cari_hesap_hareketleri` | `sync_queue` | yok | skip | Queue okunur ama ERP'ye yazma uygulanmamis |
| `reyon` | Web -> ERP | PostgreSQL | `reyon_tanimlari` | `sync_queue` | `STOK_REYONLARI` | insert/update | Yardimci ERP yazimi |
| `stok` | ERP -> Web | MS SQL | `STOKLAR` | `sync_state`, `int_kodmap_stok` | `stoklar` | upsert | `sto_lastup_date` ile incremental |
| `barkod` | ERP -> Web | MS SQL | `BARKOD_TANIMLARI` | `sync_state` | `urun_barkodlari` | upsert | `bar_lastup_date` ile incremental |
| `fiyat` | ERP -> Web | MS SQL | `STOK_SATIS_FIYAT_LISTELERI` | `sync_state`, `int_kodmap_stok`, `int_kodmap_fiyat_liste` | `urun_fiyat_listeleri` | upsert | Mapping yoksa kayit atlanir |
| `cari` | ERP -> Web | MS SQL | `CARI_HESAPLAR` | `sync_state` | `cari_hesaplar` | upsert | `cari_lastup_date` veya `cari_create_date` ile incremental |
| `banka` | ERP -> Web | MS SQL | `BANKALAR` | `sync_state` | `bankalar` | upsert | `ban_lastup_date` ile incremental |
| `kasa` | ERP -> Web | MS SQL | `KASALAR` | `sync_state` | `kasalar` | upsert | `kas_lastup_date` ile incremental |
| `depo` | ERP -> Web | MS SQL | `DEPOLAR` | `sync_state` | `depolar` | bulk upsert | `dep_lastup_date` ile incremental |
| `fiyat_tanim` | ERP -> Web | MS SQL | `STOK_SATIS_FIYAT_LISTE_TANIMLARI` | `sync_state` | `fiyat_tanimlari` | upsert | `sfl_lastup_date` ile incremental |
| `eldeki_miktar` | ERP -> Web | MS SQL | `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW` | `sync_state` | `stoklar.eldeki_miktar`, `stoklar.sth_eldeki_miktar` | update | View'de `lastup_date` yok, her zaman tam sync |
| `kategori` | ERP -> Web | MS SQL | `STOK_ANA_GRUPLARI`, `STOK_ALT_GRUPLARI`, dolayli olarak `STOKLAR` | `sync_state` | `kategoriler`, sonra `stoklar.kategori_id` | upsert/update | Kategori ve stok-kategori baglari ayri asamalar |
| `xml` | ERP + Web -> Dosya/PostgreSQL | MS SQL + PostgreSQL | `STOKLAR`, `BARKOD_TANIMLARI`, `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW`, `STOK_SATIS_FIYAT_LISTELERI`, `entegra_product`, `entegra_pictures` | yok | XML dosyasi, `xmlurunler` | upsert/generate | ERP verisi ile Entegra resimleri birlestirilir |
| `entegra_product` | Queue -> SQLite | PostgreSQL | `sync_queue.record_data` | `sync_queue` | `product`, `product_quantity`, `product_description`, `product_prices` | update/insert | ERP'ye gitmez |
| `entegra_product_manual` | Queue -> SQLite | PostgreSQL | `sync_queue.record_data` | `sync_queue` | `product_quantity` | update/insert | ERP'ye gitmez |
| `entegra_pictures` | Queue -> SQLite | PostgreSQL | `sync_queue.record_data` | `sync_queue` | `pictures` | update/insert | ERP'ye gitmez |

## 4. Web / Sunucu -> Mikro ERP Yazma Akislari

Bu akislarin merkezi `services/sync-queue-worker.js` dosyasidir.

### 4.1 Queue nasil okunur

PostgreSQL `sync_queue` tablosundan kayitlar atomik olarak alinır:

- sadece `status = 'pending'` kayitlar cekilir
- `FOR UPDATE SKIP LOCKED` kullanilir
- secilen kayitlar ayni sorguda `processing` durumuna cekilir

Bu mantik ayni kaydin iki worker tarafindan ayni anda alinmasini onler.

### 4.2 `satis`

Okudugu tablolar:

- `satislar`
- `satis_kalemleri`
- yardimci tamamlayici bilgi icin `cari_hesap_hareketleri`
- eksik banka/kasa kodu icin `bankalar`, `kasalar`

Yazdigi tablolar:

- ERP: `CARI_HESAP_HAREKETLERI`
- ERP: `STOK_HAREKETLERI`
- Web geri yazim: `int_satis_mapping`
- Web geri yazim: `cari_hesap_hareketleri`
- Web geri yazim: `satislar`

Kurallar:

- `int_satis_mapping` uzerinden duplicate kontrolu yapar.
- `satis_kalemleri` yoksa islem yapmadan doner.
- asorti urunleri `ana_stok_id` altinda gruplayabilir.
- satis basligi ve kalemleri tek MS SQL transaction icinde yazilir.
- `cha_RECid_RECno` ve `sth_RECid_RECno` alanlari ERP insert sonrasinda guncellenir.
- islem bittikten sonra web tarafinda `fatura_seri_no`, `fatura_sira_no`, `belge_no` guncellenir.
- eski web kayitlarinda `erp_recno IS NULL` olan orijinal `cari_hesap_hareketleri` ve `stok_hareketleri` satirlari silinebilir.

### 4.3 `tahsilat`

Okudugu tablo:

- `tahsilatlar`

Yazdigi tablolar:

- ERP: her durumda `CARI_HESAP_HAREKETLERI`
- ERP: `cek`, `senet`, `havale`, `kredi_karti` tiplerinde once `ODEME_EMIRLERI`
- Web geri yazim: `tahsilatlar`

Kurallar:

- tahsilat tipi odeme emri gerektiriyorsa once `ODEME_EMIRLERI` kaydi olusur.
- sonra `transformTahsilat` ile `CARI_HESAP_HAREKETLERI` kaydi yazilir.
- ERP belge numarasi web `tahsilatlar` tablosuna geri yazilir.
- webde `erp_recno IS NULL` olan eski `cari_hesap_hareketleri` tahsilat kayitlari temizlenebilir.

### 4.4 `alis`

Okudugu tablolar:

- `alislar`
- `alis_kalemleri`
- kalem bazli stok kontrolu icin `stoklar`

Yazdigi tablolar:

- ERP: `CARI_HESAP_HAREKETLERI`
- ERP: `STOK_HAREKETLERI`
- gerekirse ERP: `STOKLAR`
- Web: `int_alis_mapping`

Kurallar:

- duplicate kontrolu `int_alis_mapping` ile yapilir.
- kalemdeki stok ERP'de yoksa once ERP stok kaydi acilabilir.
- baslik ve kalemler tek transaction icinde yazilir.

### 4.5 `iade`

Okudugu tablolar:

- `iadeler`
- `iade_kalemleri`

Yazdigi tablolar:

- ERP: `CARI_HESAP_HAREKETLERI`
- ERP: `STOK_HAREKETLERI`
- Web: `int_iade_mapping`

Kurallar:

- satis akisinin iade varyantidir.
- iade flagleri ve evrak tipleri farklidir.
- baslik ve kalem transaction icindedir.

### 4.6 `stok`

Okudugu tablo:

- `stoklar`

Yazdigi tablolar:

- ERP: `STOKLAR`
- ERP: `STOK_SATIS_FIYAT_LISTELERI`
- SQLite yan etki: `product_quantity`, `product_description`

Kurallar:

- eger `is_asorti = true` ise ERP stok guncellemesi atlanabilir.
- asorti durumda sadece Entegra miktar guncellemesi yapilabilir.
- ERP'de stok yoksa insert, varsa update yapar.
- satis fiyatini liste 1 uzerinden `STOK_SATIS_FIYAT_LISTELERI` tablosuna yazar.

### 4.7 `barkod`

Okudugu tablo:

- `urun_barkodlari`

Yazdigi tablo:

- ERP: `BARKOD_TANIMLARI`

Kurallar:

- barkod insert/update yapabilir.
- queue operasyonu `DELETE` ise ERP barkod kaydi silinebilir.

### 4.8 `cari`

Okudugu tablo:

- `cari_hesaplar`

Yazdigi tablo:

- ERP: `CARI_HESAPLAR`

Kurallar:

- `cari_kodu` ile ERP kaydi arar.
- yoksa insert, varsa update yapar.

### 4.9 `stok_hareket`

Okudugu tablo:

- `stok_hareketleri`

Yazdigi tablolar:

- ERP: agirlikli olarak `STOK_HAREKETLERI`
- bazi sayim senaryolarinda `SAYIM_SONUCLARI`

### 4.10 `reyon`

Okudugu tablo:

- `reyon_tanimlari`

Yazdigi tablo:

- ERP: `STOK_REYONLARI`

### 4.11 `cari_hesap_hareketleri`

Okudugu tablo:

- `cari_hesap_hareketleri`

Yazdigi tablo:

- yok

Durum:

- queue tarafinda bu entity taniniyor
- kayit okunuyor
- loglanip `skip` ediliyor
- ERP'ye yazma mantigi uygulanmamis

## 5. Mikro ERP -> Sunucu / Web Okuma Akislari

Bu akislar genellikle `sync-jobs/*.processor.js` icindeki `syncToWeb()` metodlari ile calisir. Checkpoint mantigi `services/sync-state.service.js` uzerinden tutulur.

### 5.1 `stok`

Okudugu ERP tablo:

- `STOKLAR`

Filtre:

- `sto_pasif_fl = 0`
- incremental ise `sto_lastup_date > lastSyncTime`

Yazdigi web tablolari:

- `stoklar`
- iliskili barkodlar icin `urun_barkodlari`
- mapping icin `int_kodmap_stok`

Kurallar:

- once mapping kontrol eder, mapping bozuksa `stok_kodu` ile eslestirme dener.
- kategoriyi `kategoriler.erp_id` uzerinden `kategori_id`'ye cevirir.
- stoktan sonra iliskili barkodlar ERP `BARKOD_TANIMLARI` tablosundan cekilir.

### 5.2 `barkod`

Okudugu ERP tablo:

- `BARKOD_TANIMLARI`

Filtre:

- incremental ise `bar_lastup_date > lastSyncTime`

Yazdigi web tablo:

- `urun_barkodlari`

### 5.3 `fiyat`

Okudugu ERP tablo:

- `STOK_SATIS_FIYAT_LISTELERI`

Filtre:

- `sfiyat_fiyati > 0`
- incremental ise `sfiyat_lastup_date > lastSyncTime`

Yazdigi web tablo:

- `urun_fiyat_listeleri`

Bagimlilik:

- `int_kodmap_stok`
- `int_kodmap_fiyat_liste`

Mapping yoksa:

- kayit hata vermeden atlanir

### 5.4 `cari`

Okudugu ERP tablo:

- `CARI_HESAPLAR`

Filtre:

- incremental ise `cari_lastup_date > lastSyncTime OR cari_create_date > lastSyncTime`

Yazdigi web tablo:

- `cari_hesaplar`

Kurallar:

- `cari_kodu` uzerinden upsert yapar
- `kaynak = 'erp'` yazar

### 5.5 `banka`

Okudugu ERP tablo:

- `BANKALAR`

Filtre:

- incremental ise `ban_lastup_date > lastSyncTime`

Yazdigi web tablo:

- `bankalar`

### 5.6 `kasa`

Okudugu ERP tablo:

- `KASALAR`

Filtre:

- incremental ise `kas_lastup_date > lastSyncTime`

Yazdigi web tablo:

- `kasalar`

### 5.7 `depo`

Okudugu ERP tablo:

- `DEPOLAR`

Filtre:

- incremental ise `dep_lastup_date > lastSyncTime`

Yazdigi web tablo:

- `depolar`

Kurallar:

- `erp_recno` uzerinden bulk upsert yapar

### 5.8 `fiyat_tanim`

Okudugu ERP tablo:

- `STOK_SATIS_FIYAT_LISTE_TANIMLARI`

Filtre:

- incremental ise `sfl_lastup_date > lastSyncTime`

Yazdigi web tablo:

- `fiyat_tanimlari`

### 5.9 `eldeki_miktar`

Okudugu ERP kaynak:

- `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW`

Yazdigi web tablo:

- `stoklar`

Guncelledigi alanlar:

- `eldeki_miktar`
- `sth_eldeki_miktar`
- `guncelleme_tarihi`

Ozel durum:

- bu view'de `lastup_date` olmadigi icin her zaman tam senkronizasyon yapilir

## 6. SQLite / Entegra / Yardimci Akislar

Bu akislar ERP evragi olusturmaz. AI editor bunlari "Mikro ERP'ye yazilan finansal operasyon" ile karistirmamalidir.

### 6.1 `entegra_product`

Kaynak:

- PostgreSQL `sync_queue.record_data`

Hedef:

- SQLite `product`
- SQLite `product_quantity`
- SQLite `product_description`
- SQLite `product_prices`

Kurallar:

- `record_data.changes` icinden hangi alanin nereye yazilacagi ayrilir
- `quantity` -> `product_quantity`
- `description` -> `product_description`
- fiyat alanlari -> `product_prices`
- diger alanlar -> `product`
- ERP'ye gitmez

### 6.2 `entegra_product_manual`

Kaynak:

- PostgreSQL `sync_queue.record_data`

Hedef:

- SQLite `product_quantity`

Kurallar:

- manuel stok/miktar guncellemesidir
- ERP'ye gitmez

### 6.3 `entegra_pictures`

Kaynak:

- PostgreSQL `sync_queue.record_data`

Hedef:

- SQLite `pictures`

Kurallar:

- resim metadata'sini SQLite'a yazar
- ERP'ye gitmez

### 6.4 `stockXmlService`

Kaynaklar:

- ERP: `STOKLAR`
- ERP: `BARKOD_TANIMLARI`
- ERP: `STOK_HAREKETTEN_ELDEKI_MIKTAR_VIEW`
- ERP: `STOK_SATIS_FIYAT_LISTELERI`
- PostgreSQL: `entegra_product`
- PostgreSQL: `entegra_pictures`

Hedefler:

- yerel XML dosyasi
- PostgreSQL `xmlurunler`
- opsiyonel olarak SSH ile uzak sunucu

Kurallar:

- ERP stok verisi ile Entegra fotograflari birlestirilir
- `xmlurunler` tablosuna upsert edilir
- bu akis Mikro ERP'ye veri yazmaz; ERP'den okur

### 6.5 `categorySyncService`

Kaynaklar:

- ERP: `STOK_ANA_GRUPLARI`
- ERP: `STOK_ALT_GRUPLARI`
- dolayli stok atamasi icin ERP: `STOKLAR`

Hedefler:

- PostgreSQL `kategoriler`
- PostgreSQL `stoklar.kategori_id`

Kurallar:

- ana grup ve alt grup icin `erp_id` tutar
- sonra stoklarin `sto_altgrup_kod` veya `sto_anagrup_kod` alanina gore `kategori_id` bagini gunceller

## 7. Dokunulmayan Veriler ve Bilerek Atlanan Akislar

`services/sync-queue-worker.js` icinde bir `IGNORED_ENTITY_TYPES` listesi vardir. Bu kayitlar queue'ya dusse bile ERP senkronizasyonu yapilmaz; queue kaydi `completed` yapilir.

Bu listede su tipler vardir:

- `entegra_order`
- `entegra_order_status`
- `entegra_order_product`
- `entegra_product_quantity`
- `entegra_product_prices`
- `entegra_product_info`
- `entegra_messages`
- `entegra_message_template`
- `entegra_customer`
- `entegra_brand`
- `entegra_category`
- `entegra_category2`
- `entegra_product_description`

Ek olarak:

- `cari_hesap_hareketleri` queue'da taninmistir ama ERP'ye yazma mantigi uygulanmamistir; su an sadece okunup atlanir.
- `stok.syncFromWeb()` methodu kodda "henüz desteklenmiyor" diye log yazar; stok webden ERP'ye queue ile yazilsa da ayri toplu `syncFromWeb` akisi tamamlanmamistir.
- XML akisinda ERP'den veri okunur; XML olusturmak ERP mali evrak yazimi anlamina gelmez.

## 8. Mapping ve Checkpoint Kurallari

Sistemin kritik mapping tablolari:

- `int_kodmap_cari`
- `int_kodmap_stok`
- `int_kodmap_banka`
- `int_kodmap_kasa`
- `int_kodmap_fiyat_liste`
- `INT_KdvPointerMap`
- `int_satis_mapping`
- `int_alis_mapping`
- `int_iade_mapping`

Temel kurallar:

- finansal evraklarda once mapping kontrol edilir
- mapping varsa duplicate insert yapilmamaya calisilir
- ERP yazimi basarili olduktan sonra mapping veya geri yazim yapilir
- `sync_state` her tablo ve yon icin son basarili sync zamanini tutar
- checkpoint mantigi ozellikle ERP -> Web akislarda incremental okuma icin kullanilir

## 9. Kritik Is Kurallari

- `sync_queue` kayitlari atomik alinmalidir
- `FOR UPDATE SKIP LOCKED` davranisi korunmalidir
- `pending -> processing -> completed/failed` akisi korunmalidir
- retry sayisi asilirsa kayit `failed` olmalidir
- `satis`, `alis`, `iade` icin baslik ve kalemler ayni ERP transaction icinde yazilmalidir
- ERP insert sonrasinda `RECid_RECno` alanlari guncellenmelidir
- duplicate kontrolu mapping tablolari ile yapilmalidir
- mapping bulunamayan fiyat veya stok gibi kayitlar bazi akislarda fail etmek yerine skip edilebilir; bu davranis korunmalidir
- `eldeki_miktar` icin incremental degil tam sync kullanildigi unutulmamalidir

## 10. AI Editor Icin Calisma Kurallari

Bu repoda degisiklik yapacak AI editor su sira ile okumaya baslamalidir:

1. `services/sync.service.js`
2. `services/sync-queue-worker.js`
3. ilgili entity processor'u (`sync-jobs/*.processor.js`)
4. ilgili transformer dosyasi (`transformers/*.transformer.js`)
5. `mappings/lookup-tables.js`

AI editorun korumasi gereken davranislar:

- queue mantigini bozma
- mapping tablolarini es gecme
- duplicate onleme kurallarini kaldirma
- ERP evrak sira numarasi mantigini degistirme
- `lastup_date` bazli incremental sync kuralini bozma
- `ignored entity` davranisini istemsizce ERP yazimina cevirmeme
- SQLite/Entegra akislarini ERP akislarindan ayri dusunme

AI editorun bilmesi gereken kritik ayrim:

- her `sync_queue` kaydi Mikro ERP'ye gitmez
- her ERP okuma mali evrak yazimi degildir
- bazi akislar sadece PostgreSQL veya SQLite gunceller
- sistem tek yonlu degil, cok akisli bir entegrasyon servisidir

## 11. Sonuc

Bu repo icindeki mevcut sistemin omurgasi `PostgreSQL queue + entity processor + transformer + Mikro transaction + mapping/checkpoint` modelidir. Fakat ayni anda SQLite, XML, kategori ve eldeki miktar gibi yardimci akislar da vardir. Bu nedenle herhangi bir AI ajan, sistemi "sadece satislari ERP'ye yazan servis" diye dar yorumlamamali; ama ERP mali evrak olusturan akislari da SQLite ve XML yardimci akislarla karistirmamalidir.
