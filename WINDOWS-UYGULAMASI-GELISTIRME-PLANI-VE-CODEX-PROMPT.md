# Mikro ERP Windows Senkronizasyon Ajani - Gelistirme Dokumani

Bu dokuman, mevcut `mikro_sync` projesindeki Mikro ERP veri okuma/yazma mantigini kullanarak her musterinin bilgisayarina kurulacak, API key ile lisans/kimlik kontrolu yapan, Mikro MS SQL veritabanini guvenli endpoint mantigina ceviren ve Android satis uygulamasindan gelen islemleri ERP'ye yazan Windows uygulamasinin gelistirme planidir.

Referans alinacak ana dokuman: `WINDOWS-SENKRONIZASYON-UYGULAMASI-MANTIGI.md`.

## 1. Urun Hedefi

Uygulama, Windows bilgisayarda servis veya tray uygulamasi olarak calisir. Musteri kendi Mikro veritabanina baglanti bilgilerini girer. Uygulama once merkezi API uzerinden API key kontrolu yapar, sonra yetkili musterinin Mikro veritabanindan secilen tablo/alanlari okur, web/API tarafina gonderir ve Android uygulamasindan gelen satis/tahsilat gibi kayitlari Mikro tablolarina yazar.

Ana hedefler:

- Cok kullanicili/musterili kurulum modeli.
- Her kurulum icin API key, client id ve cihaz kimligi kontrolu.
- Mikro MS SQL tablolarini kontrollu API endpoint davranisina cevirmek.
- Android satislarini endpoint/kuyruk uzerinden alip Mikro ERP'ye transaction icinde yazmak.
- ERP'den web/mobile tarafa stok, cari, fiyat, barkod, hareket ve bakiye bilgisini inkremental gondermek.
- Mevcut `mikro_sync` mapping, transformer, queue, retry, checkpoint ve idempotency mantigini korumak.
- Hata, log, manuel tekrar calistirma ve destek ekranlariyla sahada yonetilebilir olmak.

## 2. Onerilen Teknik Mimari

Onerilen teknoloji secimi:

- UI: .NET 8 WPF veya WinUI 3.
- Servis: .NET Worker Service, Windows Service olarak kurulabilir.
- Local API: ASP.NET Core Minimal API, varsayilan `localhost`.
- ERP baglantisi: Microsoft.Data.SqlClient.
- Local store: SQLite veya LiteDB.
- HTTP client: typed HttpClient + Polly retry.
- Loglama: Serilog, rolling file + local store.
- Paketleme: MSIX veya WiX/MSI.

Temel moduller:

- `LicenseService`: API key, client id, cihaz parmak izi ve lisans durumunu kontrol eder.
- `SettingsService`: MS SQL, API URL, token, secili tablolar ve sync ayarlarini sifreli saklar.
- `MikroDbConnector`: Mikro MS SQL baglantisi, query, transaction ve session context islemleri.
- `RemoteApiClient`: merkezi API ile job alma, ack gonderme ve ERP verisi push etme islemleri.
- `LocalApiHost`: local endpointleri acar; dis ag yerine `localhost` onceliklidir.
- `SyncEngine`: web_to_erp ve erp_to_web dongulerini yonetir.
- `QueueManager`: local queue, retry, lock, failed ve replay islemleri.
- `TransformerRegistry`: entity tipine gore transformer secer.
- `MappingService`: web id, ERP kod, RECno, evrak seri/sira eslestirmelerini tutar.
- `CheckpointService`: her tablo/yon icin son basarili sync noktasini saklar.
- `SchemaExplorer`: izin verilen Mikro tablolarinin kolonlarini ve ornek verisini okur.
- `AuditLogger`: islem gecmisi, hata detaylari ve destek loglarini olusturur.

## 3. Cok Musterili Calisma Modeli

Her kurulum merkezi API'da bir `client` olarak tanimlanir.

Minimum lisans alanlari:

```json
{
  "client_id": "musteri-kodu",
  "api_key": "gizli-anahtar",
  "device_id": "makine-parmak-izi",
  "tenant_id": "firma-id",
  "allowed_entities": ["stok", "cari", "satis", "tahsilat"],
  "expires_at": "2027-01-01T00:00:00Z",
  "status": "active"
}
```

Kurulum akisi:

1. Kullanici API key girer.
2. Uygulama cihaz kimligi uretir.
3. `POST /api/agent/activate` endpointine API key + cihaz bilgisi gider.
4. Merkezi API lisansi dogrular ve kisa omurlu access token dondurur.
5. Kullanici Mikro MS SQL baglanti bilgilerini girer.
6. Uygulama Mikro baglantisini test eder.
7. Uygun tablolar ve alanlar kesfedilir.
8. Sync ayarlari secilir ve servis baslatilir.

## 4. API Tasarimi

Merkezi API tarafinda onerilen endpointler:

```http
POST /api/agent/activate
POST /api/agent/heartbeat
GET  /api/sync/jobs?client_id={id}&status=pending&limit=50
POST /api/sync/jobs/{jobId}/ack
POST /api/sync/push
GET  /api/sync/config
POST /api/sync/logs
```

Android satis uygulamasi dogrudan merkezi API'ya satis gondermelidir:

```http
POST /api/mobile/sales
Authorization: Bearer <mobile-token>
```

Merkezi API bu satisi dogrudan Mikro'ya yazmaz. Once `sync_queue` icine `web_to_erp / satis / INSERT` isi olarak kaydeder. Windows ajani bu isi ceker, Mikro'ya yazar, sonucu `ack` ile geri bildirir.

Local API sadece destek ve yerel entegrasyon icin:

```http
GET  /local-api/status
POST /local-api/sync/run
GET  /local-api/erp/tables
GET  /local-api/erp/tables/{table}/schema
GET  /local-api/erp/tables/{table}/rows?since=...&limit=...
POST /local-api/erp/entities/{entity}/upsert
GET  /local-api/logs
```

Local API kurallari:

- Varsayilan sadece `127.0.0.1` dinlemeli.
- Acik tablo adi kabul edilmemeli; allowlist kullanilmali.
- SQL query kullanicidan ham alinmamali.
- Token, sifre ve connection string loglanmamali.

## 5. Veri Akislari

### Android -> API -> Windows Ajani -> Mikro

1. Android uygulamasi satis/tahsilat bilgisini merkezi API'ya gonderir.
2. Merkezi API client ve kullanici yetkisini kontrol eder.
3. Kayit web veritabanina yazilir.
4. `sync_queue` tablosuna is eklenir.
5. Windows ajani `GET /api/sync/jobs` ile isi alir.
6. `MappingService` stok, cari, kasa, banka, KDV eslesmelerini kontrol eder.
7. `TransformerRegistry` payload'u Mikro kolonlarina cevirir.
8. `MikroDbConnector` transaction baslatir.
9. `CARI_HESAP_HAREKETLERI`, `STOK_HAREKETLERI`, gerekirse `ODEME_EMIRLERI` yazilir.
10. Olusan `RECno`, evrak seri/sira ve mapping bilgileri local/web mapping'e kaydedilir.
11. Merkezi API'ya `ack completed` gonderilir.

### Mikro -> Windows Ajani -> API -> Android/Web

1. `CheckpointService` ilgili tablo icin son basarili sync zamanini okur.
2. Mikro'da `*_lastup_date` veya uygun tarih/RECno alanina gore degisen kayitlar cekilir.
3. Transformer veriyi API modeline cevirir.
4. `POST /api/sync/push` ile merkezi API'ya gonderilir.
5. API upsert yapar.
6. Basarili batch sonunda checkpoint ilerletilir.

## 6. Fazlara Bolunmus Gelistirme Plani

### Faz 0 - Analiz ve kararlar

Teslimatlar:

- Mevcut `mikro_sync` kodundan entity listesi, processor ve transformer envanteri.
- Mikro tablo/kolon allowlist karari.
- Android satis payload sozlesmesi.
- Merkezi API auth modeli.

Kabul kriterleri:

- Satis, tahsilat, stok, cari icin kaynak ve hedef tablo listesi kesinlesmis olmalidir.
- Mukerrer kayit onleme stratejisi dokumante edilmis olmalidir.

### Faz 1 - Windows uygulama iskeleti

Teslimatlar:

- .NET solution yapisi.
- WPF/WinUI ayar ekrani.
- Worker Service.
- Serilog loglama.
- Local SQLite/LiteDB store.

Kabul kriterleri:

- Uygulama acilir, ayar kaydeder, servis dongusu calisir.
- Hassas bilgiler Windows DPAPI ile sifreli saklanir.

### Faz 2 - Lisans ve aktivasyon

Teslimatlar:

- API key aktivasyon ekrani.
- `LicenseService`.
- Heartbeat.
- Token yenileme.

Kabul kriterleri:

- Gecersiz API key ile sync baslamaz.
- Lisans pasif/bitmis ise kullaniciya net hata gosterilir.

### Faz 3 - Mikro baglanti ve schema kesfi

Teslimatlar:

- MS SQL connection test.
- `SchemaExplorer`.
- Allowlist tablo/kolon secimi.
- Local API schema endpointleri.

Kabul kriterleri:

- Mikro baglantisi test edilir.
- Sadece izin verilen tablolar listelenir.

### Faz 4 - Queue, mapping ve checkpoint altyapisi

Teslimatlar:

- Local queue tablolari.
- Mapping store.
- Checkpoint store.
- Retry/backoff.
- Failed queue UI.

Kabul kriterleri:

- Ayni job iki kez calissa bile mapping nedeniyle mukerrer evrak olusmaz.
- Failed kayit UI'dan tekrar pending yapilabilir.

### Faz 5 - Web/API -> Mikro yazma

Teslimatlar:

- `satis`, `tahsilat`, `alis`, `iade`, `stok`, `cari` transformerlari.
- Mikro transaction yazma servisleri.
- Ack protokolu.

Kabul kriterleri:

- Android satisi Mikro'da cari hareket + stok hareketleri olarak tek transaction ile olusur.
- Tahsilat tipine gore `ODEME_EMIRLERI` kurali uygulanir.

### Faz 6 - Mikro -> API okuma

Teslimatlar:

- Stok, cari, fiyat, barkod ve hareket push islemleri.
- Batch ve checkpoint mantigi.
- Dongu onleme icin `source_system`/`sync_origin`.

Kabul kriterleri:

- Sadece degisen kayitlar API'ya gider.
- Basarisiz batch checkpoint ilerletmez.

### Faz 7 - UI, destek ve operasyon

Teslimatlar:

- Dashboard.
- Manuel sync.
- Mapping editor.
- Log viewer.
- Export support package.

Kabul kriterleri:

- Destek ekibi hangi kaydin hangi Mikro `RECno`/evrak no ile eslestigini gorebilir.
- Loglarda gizli bilgi bulunmaz.

### Faz 8 - Paketleme, test ve yayin

Teslimatlar:

- MSI/MSIX installer.
- Windows Service kurulumu.
- Otomatik guncelleme stratejisi.
- Entegrasyon testleri.

Kabul kriterleri:

- Temiz Windows makinede kurulum ve kaldirma calisir.
- Internet kopmasi, DB timeout, duplicate job ve mapping eksigi senaryolari test edilir.

## 7. Kritik Is Kurallari

- Mikro yazma islemleri transaction olmadan yapilmaz.
- Satis/alis/iade evraklari baslik ve kalemleriyle birlikte atomik yazilir.
- `RECno` degerleri olustuktan sonra ilgili `*_RECid_RECno` alanlari guncellenir.
- Stok kodu, cari kodu, banka kodu, kasa kodu ve KDV pointer mapping olmadan finansal evrak yazilmaz.
- Mapping varsa insert yerine idempotent tamamlanmis davranis uygulanir veya kontrollu update yapilir.
- Retry edilebilir hatalar ile veri hatalari ayrilir.
- Checkpoint sadece basarili batch sonunda ilerler.
- API ve local endpointler ham SQL calistirma yetenegi vermez.

## 8. Test Matrisi

Minimum senaryolar:

- Gecerli/gecersiz API key.
- Mikro baglanti basarili/basarisiz.
- Tek kalem satis.
- Cok kalem satis.
- Nakit, havale, kredi karti, cek, senet tahsilat.
- Eksik cari mapping.
- Eksik stok mapping.
- Ayni satis job'unun iki kez gelmesi.
- Transaction ortasinda hata.
- Internet kesintisi.
- Mikro DB timeout/deadlock.
- ERP'de stok degisikligi ve checkpoint ilerleme.
- Failed queue retry.
- Local API allowlist disi tablo istegi.

## 9. Codex Icin Kullanilacak Skill'ler

Bu calisma icin olusturulan skill'ler:

- `$mikro-windows-sync-architect`: Windows ajan mimarisi, faz planlama, modul sinirlari ve is akisi tasarimi.
- `$mikro-erp-mapping-transformers`: Mikro tablo mapping, transformer, transaction ve idempotency uygulama kurallari.
- `$sync-agent-security-release`: API key, secrets, local API guvenligi, paketleme ve saha yayini kontrolleri.

## 10. Codex'e Verilecek Gelismis Prompt

Asagidaki prompt'u yeni bir Codex oturumuna ver:

```text
Use $mikro-windows-sync-architect, $mikro-erp-mapping-transformers, and $sync-agent-security-release.

Bu repodaki mevcut `mikro_sync` projesini incele. Ozellikle su dosyalari ve klasorleri referans al:
- WINDOWS-SENKRONIZASYON-UYGULAMASI-MANTIGI.md
- services/sync-queue-worker.js
- services/sync.service.js
- services/mssql.service.js
- services/postgresql.service.js
- services/sync-state.service.js
- sync-jobs/*.processor.js
- transformers/*.transformer.js
- mappings/lookup-tables.js
- mapping_alaneslesmesi_*.json
- Mapping_Reference.md

Hedefim yeni bir Windows uygulamasi gelistirmek:
- Her musterinin bilgisayarina kurulacak.
- Ilk acilista API key kontrolu yapacak.
- Musteri Mikro MS SQL veritabani baglanti bilgilerini girecek.
- Uygulama Mikro veritabanindaki izin verilen tablo ve alanlari merkezi API endpoint mantigina cevirecek.
- Android uygulamasindan gelen satis/tahsilat islerini merkezi API'daki queue uzerinden alip Mikro ERP'ye yazacak.
- Mikro ERP'deki stok, cari, fiyat, barkod ve hareket degisikliklerini merkezi API'ya push edecek.
- Mevcut projedeki queue, mapping, transformer, transaction, checkpoint, retry, failed queue ve idempotency mantigini birebir koruyacak.

Once repoyu oku ve mevcut veri akisini cikar. Sonra yeni Windows ajan icin .NET 8 tabanli solution tasarla ve uygula.

Teknik beklentiler:
- UI: WPF veya WinUI 3.
- Background worker: Windows Service olarak calisabilir olmali.
- Local API: ASP.NET Core Minimal API; varsayilan sadece localhost.
- ERP: Microsoft.Data.SqlClient ile Mikro MS SQL.
- Local store: SQLite veya LiteDB.
- HTTP: typed HttpClient ve retry/backoff.
- Log: Serilog.
- Secrets: Windows DPAPI veya Credential Manager ile sifreli saklama.
- Installer: MSI/MSIX veya WiX hazirligi.

Uygulama modulleri:
- LicenseService
- SettingsService
- MikroDbConnector
- RemoteApiClient
- LocalApiHost
- SyncEngine
- QueueManager
- TransformerRegistry
- MappingService
- CheckpointService
- SchemaExplorer
- AuditLogger
- WindowsServiceHost

Uygulanacak ilk MVP:
1. Solution ve proje yapisini olustur.
2. Ayarlar ekraninda API URL, API key, MS SQL server, database, user, password alanlarini ekle.
3. API key aktivasyon ve Mikro connection test ekle.
4. Local encrypted settings store ekle.
5. Queue, mapping ve checkpoint icin local store schema tasarla.
6. Remote API'dan pending job cekme ve ack gonderme altyapisini yaz.
7. Satis job'u icin mevcut `satis.processor.js` ve `satis.transformer.js` mantigini .NET servislerine aktar.
8. Satisi Mikro'da `CARI_HESAP_HAREKETLERI` ve `STOK_HAREKETLERI` tablolarina tek transaction ile yaz.
9. Idempotency icin once mapping kontrol et; mapping varsa tekrar insert yapma.
10. Failed queue ve log ekranini ekle.
11. En azindan unit test ve bir fake/in-memory entegrasyon test iskeleti ekle.

Guvenlik kurallari:
- Connection string, sifre, token loglama.
- Local API'yi dis internete acma.
- Allowlist disindaki Mikro tablolarini endpoint olarak sunma.
- Ham SQL endpointi yapma.
- Tum yazma islemlerinde parametreli query kullan.

Kabul kriterleri:
- Gecersiz API key ile servis baslamaz.
- Mikro connection test calisir.
- Pending satis job'u cekilir.
- Satis transaction icinde Mikro'ya yazilir.
- Basarili is API'ya ack edilir.
- Hata halinde retry/failed mantigi calisir.
- Ayni job tekrar geldiginde mukerrer evrak olusmaz.
- Log ekraninda islem sonucu gorulur.

Onemli: Uygulamayi once MVP olarak calisir hale getir. Mevcut repo mantigini bozmadan, yeni Windows uygulama kodunu ayri bir klasor veya solution altinda tut. Gereksiz refactor yapma. Her faz sonunda calistirilabilir ve test edilebilir bir durum birak.
```
