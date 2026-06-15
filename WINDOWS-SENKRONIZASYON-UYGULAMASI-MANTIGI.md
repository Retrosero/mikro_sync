# Windows Senkronizasyon Uygulamasi Icin ERP-Web Veri Aktarim Mantigi

Bu dokuman, mevcut `mikro_sync` uygulamasinin web tarafindan gelen verileri Mikro ERP MS SQL tablolarina nasil yazdigini aciklar ve yeni gelistirilecek Windows senkronizasyon uygulamasi icin uygulanabilir mimariyi tarif eder.

Hedef yeni uygulama:

- ERP veritabanindaki tablolari API endpointleri gibi okunabilir/yazilabilir hale getirmeli.
- Web/API tarafindan gelen satis, tahsilat, alis, iade, stok, cari gibi kayitlari ERP tablolarina yazabilmeli.
- ERP tarafinda degisen stok, cari, fiyat, barkod, hareket gibi kayitlari web/API tarafina gonderebilmeli.
- Kuyruk, retry, mapping, loglama ve idempotency mantigi ile guvenli calismali.

## 1. Mevcut Uygulamanin Ana Mantigi

Mevcut uygulamada iki veritabani vardir:

- Web veritabani: PostgreSQL
- ERP veritabani: MS SQL Server, Mikro ERP tablolari

Mevcut sistemde web tarafindan gelen veriler dogrudan ERP'ye yazilmaz. Once PostgreSQL tarafinda `sync_queue` tablosuna is kaydi duser. Sonra `SyncQueueWorker` bu kuyrugu okuyup ilgili processor sinifina gonderir. Processor, web kaydini ERP kolonlarina cevirir ve MS SQL transaction icinde ERP tablolarina yazar.

Ana dosyalar:

- `services/sync-queue-worker.js`: Web -> ERP kuyrugunu isler.
- `services/sync.service.js`: Ana dongu; Web -> ERP, ERP -> Web, kategori, Entegra, XML gibi isleri calistirir.
- `services/mssql.service.js`: ERP MS SQL baglantisi, query, transaction ve stored procedure calistirma katmani.
- `services/postgresql.service.js`: Web PostgreSQL baglantisi.
- `sync-jobs/*.processor.js`: Her veri tipi icin is kurali ve ERP yazma mantigi.
- `transformers/*.transformer.js`: Web kolonlarini ERP kolonlarina ceviren katman.
- `mappings/lookup-tables.js`: Web ID -> ERP kod eslestirmeleri.
- `services/sync-state.service.js`: Son senkronizasyon zamanini tutar.

## 2. Mevcut Web -> ERP Akisi

Web tarafinda bir kayit olustugunda veya guncellendiginde su akis calisir:

1. Web uygulamasi `satislar`, `tahsilatlar`, `alislar`, `iadeler`, `stoklar`, `cari_hesaplar` gibi tablolara veri yazar.
2. PostgreSQL trigger veya uygulama kodu `sync_queue` tablosuna bir is ekler.
3. Kuyruk kaydi su bilgileri tasir:

```json
{
  "entity_type": "satis",
  "entity_id": "web-kayit-id",
  "operation": "INSERT",
  "status": "pending",
  "retry_count": 0,
  "record_data": {}
}
```

4. `SyncQueueWorker` pending kayitlari atomik olarak alir ve `processing` durumuna ceker.
5. `entity_type` degerine gore dogru processor secilir.
6. Processor web tablosundan asil kaydi ve gerekirse alt kalemleri okur.
7. Mapping tablolarindan ERP kodlari bulunur.
8. Transformer web verisini Mikro ERP kolon formatina cevirir.
9. MS SQL transaction baslatilir.
10. ERP tablolarina insert/update yapilir.
11. ERP'den olusan `RECno`, evrak seri/sira no gibi degerler web tarafina geri yazilir.
12. Basarili ise queue `completed`, hata varsa retry veya `failed` olur.

## 3. Queue Tasarimi

Yeni Windows uygulamasinda da ayni kuyruk mantigi korunmali. Trigger zorunlu degildir; API tabanli yapida kuyruk API uzerinden de doldurulabilir.

Onerilen `sync_queue` alanlari:

```sql
id                uniqueidentifier / uuid
direction         varchar(20)    -- web_to_erp veya erp_to_web
entity_type       varchar(50)    -- satis, tahsilat, stok, cari vb.
entity_id         varchar(100)   -- kaynak sistemdeki kayit id
operation         varchar(10)    -- INSERT, UPDATE, DELETE, UPSERT
payload           nvarchar(max)  -- JSON veri
status            varchar(20)    -- pending, processing, completed, failed
retry_count       int
max_retry_count   int
error_message     nvarchar(max)
created_at        datetime
processed_at      datetime
locked_at         datetime
lock_owner        varchar(100)
external_ref      varchar(100)   -- web id veya ERP recno gibi dis referans
```

Kuyruk isleme kurali:

- Worker ayni anda en fazla belirlenen batch kadar kayit almali.
- Ayni kayit birden fazla worker tarafindan islenmemeli.
- Kayit islenmeden once `processing` durumuna alinmali.
- Basarili islemde `completed` yapilmali.
- Gecici hatalarda `pending` durumuna geri alinip `retry_count` artirilmali.
- Retry limiti asilinca `failed` yapilmali.
- Failed kayitlar manuel olarak tekrar `pending` yapilabilmeli.

## 4. Yeni Windows Uygulamasi Icin Onerilen Mimari

Yeni uygulama Windows makinede calisan bir servis gibi dusunulmeli.

Onerilen bilesenler:

- Windows Service / Tray App: Surekli calisan ana uygulama.
- Local ERP Connector: Mikro ERP MS SQL veritabanina baglanir.
- Remote API Client: Web/API sunucusu ile konusur.
- Local API Server: ERP tablolarini endpoint gibi acabilir.
- Sync Engine: Iki yonlu veri aktarimini yonetir.
- Transformer Layer: Web modeli ile ERP tablo kolonlarini birbirine cevirir.
- Mapping Store: Web ID ve ERP kod/recno eslestirmelerini tutar.
- Queue Store: Is kuyrugu ve retry durumlarini tutar.
- Log/Monitoring: Dosya logu, UI durum ekrani, hata listesi.

Yeni uygulama iki modda calisabilir:

- Pull Mode: Windows uygulamasi belirli araliklarla web API'dan bekleyen isleri ceker.
- Push Mode: Web uygulamasi Windows uygulamasinin local API endpointine is gonderir.

Pratik ve guvenli onerilen yapi: Pull Mode.

Sebep:

- ERP genellikle lokal ag icindedir, disaridan erisilmesi risklidir.
- Windows servis web API'ya cikis yaparak baglanir; firewall/NAT sorunu azalir.
- Internet koparsa kuyruk bekler, sonra devam eder.

## 5. Onerilen API Endpointleri

Yeni uygulamada ERP tablolari dogrudan API gibi sunulacaksa asagidaki endpoint yapisi kullanilabilir.

### 5.1 Web API Tarafi

Windows servis web tarafindan is almak icin:

```http
GET /api/sync/jobs?direction=web_to_erp&status=pending&limit=50
```

Web API ornek cevap:

```json
{
  "items": [
    {
      "id": "queue-id",
      "entity_type": "satis",
      "entity_id": "web-satis-id",
      "operation": "INSERT",
      "payload": {
        "satis": {},
        "kalemler": []
      }
    }
  ]
}
```

Windows servis is sonucunu web API'ya bildirir:

```http
POST /api/sync/jobs/{queueId}/ack
```

Basarili sonuc:

```json
{
  "status": "completed",
  "erp_result": {
    "erp_recno": 12345,
    "evrak_seri": "S",
    "evrak_no": 10025
  }
}
```

Hatali sonuc:

```json
{
  "status": "failed",
  "retryable": true,
  "error_message": "Cari mapping bulunamadi: web_cari_id=..."
}
```

Windows servis ERP'den degisen verileri web'e gondermek icin:

```http
POST /api/sync/push
```

Ornek:

```json
{
  "direction": "erp_to_web",
  "entity_type": "stok",
  "operation": "UPSERT",
  "items": [
    {
      "erp_key": "STK001",
      "data": {
        "stok_kodu": "STK001",
        "stok_adi": "Urun adi",
        "satis_fiyati": 100,
        "eldeki_miktar": 5
      }
    }
  ]
}
```

### 5.2 Windows Local API Tarafi

ERP tablolarini endpoint gibi acmak icin Windows uygulamasi lokal bir API sunabilir.

```http
GET /local-api/erp/tables
GET /local-api/erp/tables/{tableName}/schema
GET /local-api/erp/tables/{tableName}/rows?since=2026-01-01T00:00:00&limit=100
POST /local-api/erp/tables/{tableName}/upsert
POST /local-api/sync/run
GET /local-api/sync/status
GET /local-api/sync/logs
```

Bu local API dis internete acilmamali. Sadece `localhost` veya guvenli yerel ag uzerinden calismali.

## 6. Entity Type -> ERP Tablo Eslesmeleri

### 6.1 Satis

Web tablolari:

- `satislar`
- `satis_kalemleri`
- `cari_hesap_hareketleri` yardimci hareket bilgisi icin

ERP tablolari:

- `CARI_HESAP_HAREKETLERI`: Satis baslik/cari hareket kaydi
- `STOK_HAREKETLERI`: Satis kalemleri

Mevcut akis:

1. `satislar` kaydi alinir.
2. `satis_kalemleri` satis id ile okunur.
3. `int_satis_mapping` kontrol edilir. Daha once aktarilmissa tekrar yazilmaz.
4. Cari hareket bilgisi varsa odeme sekli, banka/kasa kodlari oradan tamamlanir.
5. `transformSatisBaslik` ile `cha_*` alanlari hazirlanir.
6. ERP'de yeni evrak sira no hesaplanir.
7. `CARI_HESAP_HAREKETLERI` tablosuna insert edilir.
8. Olusan `cha_RECno`, `cha_RECid_RECno` alanina geri yazilir.
9. Her satis kalemi `transformSatisKalem` ile `sth_*` alanlarina cevrilir.
10. `STOK_HAREKETLERI` tablosuna insert edilir.
11. Olusan `sth_RECno`, `sth_RECid_RECno` alanina geri yazilir.
12. Web tarafinda `int_satis_mapping` guncellenir.
13. Web `satislar` kaydina ERP evrak seri/sira no geri yazilir.

Kritik kurallar:

- Satis tek transaction icinde yazilmali.
- Baslik yazildi ama kalem yazilamadi gibi yarim durum kalmamali.
- `int_satis_mapping` olmadan ayni satis tekrar ERP'ye yazilabilir; bu nedenle idempotency sarttir.
- Asorti urunler ana stok altinda gruplanir.

### 6.2 Tahsilat

Web tablosu:

- `tahsilatlar`

ERP tablolari:

- `CARI_HESAP_HAREKETLERI`
- `ODEME_EMIRLERI` sadece cek, senet, havale, kredi karti gibi tiplerde

Mevcut akis:

1. `tahsilatlar` kaydi alinir.
2. Tahsilat tipi belirlenir: `nakit`, `cek`, `senet`, `havale`, `kredi_karti`.
3. Cek/senet/havale/kredi karti ise once `ODEME_EMIRLERI` kaydi olusturulur.
4. `transformTahsilat` ile `cha_*` alanlari hazirlanir.
5. `CARI_HESAP_HAREKETLERI` tablosuna insert edilir.
6. `cha_RECid_RECno` guncellenir.
7. Web `tahsilatlar` tablosuna tahsilat seri/sira no geri yazilir.

Odeme tipi kurallari:

- Nakit: kasa kodu `cha_kasa_hizkod` alanina gider, `cha_kod` cari kod olarak kalir.
- Havale/kredi karti: banka kodu kullanilir, `cha_cinsi` havale icin 17, kredi karti icin 19 olur.
- Cek: `ODEME_EMIRLERI` + `cha_cinsi=1`.
- Senet: `ODEME_EMIRLERI` + `cha_cinsi=2`.

### 6.3 Alis

Web tablolari:

- `alislar`
- `alis_kalemleri`

ERP tablolari:

- `CARI_HESAP_HAREKETLERI`
- `STOK_HAREKETLERI`
- Gerekirse `STOKLAR`

Mevcut akis:

1. `int_alis_mapping` kontrol edilir.
2. Alis kalemleri okunur.
3. Kalemdeki stok ERP'de yoksa once `STOKLAR` tablosuna eklenir.
4. Alis baslik `CARI_HESAP_HAREKETLERI` tablosuna yazilir.
5. Alis kalemleri `STOK_HAREKETLERI` tablosuna yazilir.
6. Web `alislar` kaydina ERP evrak no geri yazilir.
7. `int_alis_mapping` olusturulur.

### 6.4 Iade

Web tablolari:

- `iadeler`
- `iade_kalemleri`

ERP tablolari:

- `CARI_HESAP_HAREKETLERI`
- `STOK_HAREKETLERI`

Mevcut akis satisa benzer; farkli olarak iade flagleri ve hareket tipleri kullanilir.

### 6.5 Stok

Web tablolari:

- `stoklar`
- `urun_barkodlari`
- `urun_fiyat_listeleri`

ERP tablolari:

- `STOKLAR`
- `STOK_SATIS_FIYAT_LISTELERI`
- `BARKOD_TANIMLARI`

ERP -> Web akis:

1. `STOKLAR` tablosunda `sto_lastup_date` son sync zamanindan buyuk olan kayitlar okunur.
2. `stoklar` tablosuna upsert edilir.
3. `int_kodmap_stok` mapping tablosu guncellenir.
4. `BARKOD_TANIMLARI` okunur ve `urun_barkodlari` tablosuna yazilir.

Web -> ERP akis:

1. Web `stoklar` kaydi okunur.
2. `STOKLAR` tablosunda `sto_kod` ile aranir.
3. Yoksa insert edilir, varsa update edilir.
4. `STOK_SATIS_FIYAT_LISTELERI` liste no 1 fiyati insert/update edilir.
5. `sto_RECid_RECno` ve `sfiyat_RECid_RECno` olusan RECno ile guncellenir.

Kritik kurallar:

- Stok kodu ERP tarafinda ana benzersiz anahtar gibi kullanilir.
- String alanlari Mikro kolon uzunluklarina gore kirpilmalidir.
- Asorti urunler ERP stok guncellemesinde atlanabilir, sadece Entegra/yardimci sistem miktari guncellenebilir.

### 6.6 Cari

Web tablosu:

- `cari_hesaplar`

ERP tablosu:

- `CARI_HESAPLAR`

ERP -> Web akis:

1. `CARI_HESAPLAR` tablosunda `cari_lastup_date` veya `cari_create_date` son sync zamanindan buyuk kayitlar okunur.
2. `cari_hesaplar` tablosuna `cari_kodu` uzerinden upsert edilir.

Web -> ERP akis:

1. Web `cari_hesaplar` kaydi okunur.
2. ERP'de `cari_kod` ile aranir.
3. Yoksa `CARI_HESAPLAR` insert edilir.
4. Varsa unvan, vergi, telefon, eposta gibi alanlar update edilir.
5. `cari_RECid_RECno` olusan RECno ile guncellenir.

## 7. Mapping Mantigi

ERP ve web ayni ID sistemini kullanmaz. Bu nedenle mapping zorunludur.

Mevcut mapping tablolari:

- `int_kodmap_cari`: web cari id -> ERP cari kod
- `int_kodmap_stok`: web stok id -> ERP stok kod
- `int_kodmap_banka`: web banka id -> ERP banka kod
- `int_kodmap_kasa`: web kasa id -> ERP kasa kod
- `int_kodmap_fiyat_liste`: web fiyat liste id -> ERP liste no
- `INT_KdvPointerMap`: KDV orani -> Mikro vergi pointer
- `int_satis_mapping`: web satis id -> ERP evrak seri/no
- `int_alis_mapping`: web alis id -> ERP evrak seri/no
- `int_iade_mapping`: web iade id -> ERP evrak seri/no

Yeni uygulamada mapping tablolari mutlaka korunmali veya yeni bir local mapping store olusturulmalidir.

Onerilen mapping kaydi:

```json
{
  "entity_type": "stok",
  "web_id": "uuid",
  "erp_key": "STK001",
  "erp_recno": 123,
  "last_synced_at": "2026-06-11T10:00:00Z"
}
```

## 8. Idempotency ve Mukerrer Kayit Onleme

Yeni Windows uygulamasinda en kritik konu ayni kaydin ERP'ye iki kez yazilmamasidir.

Kurallar:

- Her web kaydinin benzersiz `external_id` degeri olmali.
- ERP'ye yazmadan once mapping tablosu kontrol edilmeli.
- Mapping varsa tekrar insert yapilmamali; gerekiyorsa update davranisi uygulanmali.
- Satis, alis, iade gibi evraklarda `web_id -> erp_evrak_seri + erp_evrak_no` mappingi tutulmali.
- ERP transaction basarili olduktan sonra mapping kaydi yazilmali.
- Mapping yazilamadiysa ayni is tekrar calistiginda ERP'de evrak var mi diye ikincil kontrol yapilmali.

## 9. ERP Yazma Kurallari

MS SQL tarafinda yazma islemleri mutlaka transaction icinde yapilmali.

Ornek satis transaction akisi:

```text
BEGIN TRANSACTION
  INSERT CARI_HESAP_HAREKETLERI
  UPDATE CARI_HESAP_HAREKETLERI SET cha_RECid_RECno = cha_RECno
  INSERT STOK_HAREKETLERI satir 1
  UPDATE STOK_HAREKETLERI SET sth_RECid_RECno = sth_RECno
  INSERT STOK_HAREKETLERI satir 2
  UPDATE STOK_HAREKETLERI SET sth_RECid_RECno = sth_RECno
COMMIT
```

Hata durumunda:

```text
ROLLBACK
queue.status = pending veya failed
error_message = hata detayi
```

## 10. ERP -> Web Inkremental Senkronizasyon

ERP'den web'e veri gonderirken son senkronizasyon zamani tutulmalidir.

Mevcut `sync_state` mantigi:

```sql
tablo_adi
yon
son_senkronizasyon_zamani
kayit_sayisi
basarili
hata_mesaji
```

ERP sorgusu ornegi:

```sql
SELECT *
FROM STOKLAR
WHERE sto_pasif_fl = 0
  AND sto_lastup_date > @lastSyncTime
ORDER BY sto_lastup_date
```

Yeni uygulamada her tablo icin ayri checkpoint tutulmali:

- `STOKLAR / erp_to_web`
- `CARI_HESAPLAR / erp_to_web`
- `BARKOD_TANIMLARI / erp_to_web`
- `STOK_SATIS_FIYAT_LISTELERI / erp_to_web`
- `satislar / web_to_erp`
- `tahsilatlar / web_to_erp`

Checkpoint sadece basarili batch sonunda ilerletilmeli.

## 11. Dongu Onleme

Iki yonlu senkronizasyonda en buyuk risk verinin geri donup sonsuz dongu olusturmasidir.

Mevcut sistemde `kaynak` alani kullanilir:

- Web'de olusan kayit: `kaynak = 'web'`
- ERP'den web'e gelen kayit: `kaynak = 'erp'`

Trigger veya queue olusturma mantigi sadece uygun kaynak icin calismalidir.

Yeni uygulamada onerilen alanlar:

```json
{
  "source_system": "web",
  "sync_origin": "windows-agent",
  "external_ref": "..."
}
```

Kurallar:

- Windows servis ERP'den web'e kayit gonderdiginde web bunu tekrar `web_to_erp` queue'ya atmamalidir.
- Web'den ERP'ye yazilan kaydin ERP triggeri varsa tekrar `erp_to_web` queue'ya dusmemelidir.
- MS SQL session context veya uygulama seviyesinde `SYNC_ORIGIN` kullanilabilir.

Mevcut MS SQL servisinde procedure calistirirken:

```sql
EXEC sp_set_session_context 'SYNC_ORIGIN', 'WEB'
```

Benzer mantik yeni uygulamada da korunmalidir.

## 12. Hata Yonetimi

Hatalar ikiye ayrilmalidir:

- Gecici hatalar: network, timeout, deadlock, database locked, API 5xx.
- Kalici/veri hatalari: mapping yok, zorunlu alan bos, stok/cari bulunamadi, kolon uzunlugu asildi.

Gecici hatalar:

- Retry yap.
- Exponential backoff uygula.
- Retry limiti dolunca failed yap.

Kalici hatalar:

- Direkt failed yapilabilir.
- UI'da kullaniciya duzeltilecek alan/mapping gosterilmeli.

Ornek hata mesaji:

```text
Cari mapping bulunamadi. Web cari id: 8f...
Cozum: int_kodmap_cari tablosuna web_cari_id -> erp_cari_kod eslesmesi ekleyin.
```

## 13. Windows Uygulamasi Icin Ekran/Ozellik Listesi

Minimax ile gelistirilecek uygulamada su ekranlar istenmeli:

- Baglanti Ayarlari: MS SQL server, database, kullanici, sifre, web API URL, API token.
- Test Connection: ERP ve API baglantisini test eder.
- Sync Dashboard: pending, processing, completed, failed sayilari.
- Manuel Sync: secili tablo veya tum tablolar icin senkronizasyon baslatir.
- Mapping Ekrani: cari, stok, banka, kasa eslestirmelerini listeler ve duzenler.
- Failed Queue Ekrani: hatali kayitlari, hata mesajini ve retry butonunu gosterir.
- Log Ekrani: son islemler, sureler, hata detaylari.
- Tablo Endpoint Ekrani: ERP tablolarini listele, schema goster, ornek veri cek.

## 14. Minimax Icin Net Gelistirme Talimati

Yeni Windows uygulamasini su prensiple hazirla:

```text
Windows makinede calisan bir senkronizasyon servisi yap.
Servis Mikro ERP MS SQL veritabanina baglanacak ve web API ile konusacak.
Uygulama hem ERP -> Web hem Web -> ERP veri aktarimi yapacak.
Web tarafindan gelen isler queue mantigi ile alinacak.
ERP'ye yazilan her is transaction icinde yapilacak.
Ayni kaydin iki kere yazilmamasi icin mapping ve idempotency kontrolu olacak.
ERP tablolarindaki degisiklikler lastup_date alanlari ve sync_state checkpointleri ile inkremental cekilecek.
Her tablo icin transformer katmani olacak.
Kuyruk, retry, failed kayitlar, loglar ve manuel tekrar calistirma ekrani olacak.
```

Minimum teknik moduller:

- `DatabaseConnector`: MS SQL baglantisi.
- `ApiClient`: Web API ile GET/POST/ACK islemleri.
- `QueueManager`: local/web queue islemleri.
- `SyncEngine`: iki yonlu senkronizasyonu yonetir.
- `TransformerRegistry`: entity tipine gore transformer secer.
- `MappingService`: web id ve ERP kod/recno eslestirmelerini yonetir.
- `CheckpointService`: son sync zamanlarini tutar.
- `Logger`: dosya ve UI loglari.
- `WindowsServiceHost`: servis olarak calisma.
- `LocalRestApi`: ERP tablolarini endpoint olarak sunma.

## 15. Ornek Web -> ERP Pseudocode

```pseudo
function processWebToErpJob(job):
    markJobProcessing(job.id)

    try:
        if mappingExists(job.entity_type, job.entity_id):
            markJobCompleted(job.id)
            return

        payload = job.payload
        transformer = getTransformer(job.entity_type)
        erpCommands = transformer.toErp(payload)

        beginTransaction()
        result = executeErpCommands(erpCommands)
        commitTransaction()

        saveMapping(job.entity_type, job.entity_id, result.erp_key, result.erp_recno)
        ackWebApi(job.id, completed, result)
        markJobCompleted(job.id)

    catch retryableError:
        rollbackTransaction()
        increaseRetry(job.id)
        markJobPendingOrFailed(job.id)

    catch validationError:
        rollbackTransaction()
        markJobFailed(job.id, validationError.message)
```

## 16. Ornek ERP -> Web Pseudocode

```pseudo
function syncErpTableToWeb(tableName):
    lastSync = checkpoint.get(tableName, "erp_to_web")
    rows = erp.queryChangedRows(tableName, lastSync, limit)

    transformedItems = []
    for row in rows:
        transformer = getTransformer(tableName)
        transformedItems.add(transformer.fromErp(row))

    response = webApi.push(tableName, transformedItems)

    if response.success:
        checkpoint.update(tableName, "erp_to_web", now)
    else:
        logError(response.error)
```

## 17. Guvenlik Notlari

- ERP MS SQL bilgileri sifreli saklanmali.
- API token veya client secret kullanilmali.
- Local API varsayilan olarak sadece `localhost` dinlemeli.
- Dis agdan local ERP API'ya direkt erisim acilmamali.
- Loglarda sifre, token, connection string yazilmamali.
- Her API isteginde `client_id`, `timestamp`, `signature` veya bearer token kullanilmali.

## 18. Basari Kriterleri

Yeni uygulama asagidaki durumlari sorunsuz yapabiliyorsa mevcut mantik dogru aktarilmis olur:

- Web'de olusan satis ERP'de `CARI_HESAP_HAREKETLERI` ve `STOK_HAREKETLERI` tablolarina tek transaction ile yaziliyor.
- Web'de olusan tahsilat ERP'de `CARI_HESAP_HAREKETLERI`, gerekirse `ODEME_EMIRLERI` tablosuna yaziliyor.
- ERP'de degisen stok web'e sadece degisen kayit olarak gidiyor.
- Cari, stok, banka, kasa mapping eksikse is failed oluyor ve anlasilir hata veriyor.
- Ayni queue kaydi tekrar calissa bile ERP'de mukerrer evrak olusmuyor.
- Internet veya database hatasinda uygulama durmuyor, retry ediyor.
- Failed kayitlar UI'dan tekrar calistirilabiliyor.
- Her islem loglaniyor ve hangi web kaydinin hangi ERP `RECno` veya evrak no ile eslestigi gorulebiliyor.

