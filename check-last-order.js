require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function checkLastOrder() {
    try {
        console.log('Son sipariş kaydı kontrol ediliyor (Evrak No: 30)...\n');

        // ERP'de kontrol
        await mssqlService.connect();
        const erpRecord = await mssqlService.query(`
            SELECT TOP 1
                cha_RECno, cha_kod, cha_ciro_cari_kodu, cha_aciklama, 
                cha_tpoz, cha_cari_cins, cha_grupno, cha_meblag, cha_evrakno_sira
            FROM CARI_HESAP_HAREKETLERI
            WHERE cha_evrakno_sira = 30
            ORDER BY cha_RECno DESC
        `);

        if (erpRecord.length === 0) {
            console.log('ERP\'de Evrak No 30 bulunamadı!');
            return;
        }

        const erp = erpRecord[0];
        console.log('=== ERP KAYDI (Evrak No: 30) ===');
        console.log('cha_RECno:', erp.cha_RECno);
        console.log('cha_kod:', erp.cha_kod);
        console.log('cha_ciro_cari_kodu:', erp.cha_ciro_cari_kodu);
        console.log('cha_aciklama:', erp.cha_aciklama);
        console.log('cha_tpoz:', erp.cha_tpoz);
        console.log('cha_cari_cins:', erp.cha_cari_cins);
        console.log('cha_grupno:', erp.cha_grupno);
        console.log('cha_meblag:', erp.cha_meblag);

        // Web'de kontrol
        await pgService.connect();
        const webRecord = await pgService.query(`
            SELECT ch.*, c.cari_adi, c.cari_kodu
            FROM cari_hesap_hareketleri ch
            LEFT JOIN cari_hesaplar c ON c.id = ch.cari_hesap_id
            WHERE ch.erp_recno = $1
        `, [erp.cha_RECno]);

        if (webRecord.length > 0) {
            const web = webRecord[0];
            console.log('\n=== WEB KAYDI ===');
            console.log('hareket_tipi:', web.hareket_tipi);
            console.log('hareket_turu:', web.hareket_turu);
            console.log('banka_kodu:', web.banka_kodu);
            console.log('cari_kodu:', web.cari_kodu);
            console.log('cari_adi:', web.cari_adi);

            console.log('\n=== BEKLENEN DEĞERLER ===');
            if (web.hareket_turu === 'Bankadan K.' || web.hareket_turu === 'Kredi Kartı' || web.hareket_turu === 'Havale') {
                console.log('Hareket Türü: BANKA İŞLEMİ');
                console.log('cha_tpoz: 1 (Gerçek:', erp.cha_tpoz, erp.cha_tpoz === 1 ? '✓' : '✗)');
                console.log('cha_cari_cins: 2 (Gerçek:', erp.cha_cari_cins, erp.cha_cari_cins === 2 ? '✓' : '✗)');
                console.log('cha_grupno: 1 (Gerçek:', erp.cha_grupno, erp.cha_grupno === 1 ? '✓' : '✗)');
                console.log('cha_kod: Banka Kodu (Gerçek:', erp.cha_kod, ')');
                console.log('cha_ciro_cari_kodu:', web.cari_kodu, '(Gerçek:', erp.cha_ciro_cari_kodu, erp.cha_ciro_cari_kodu === web.cari_kodu ? '✓' : '✗)');
                console.log('cha_aciklama:', web.cari_adi, '(Gerçek:', erp.cha_aciklama, erp.cha_aciklama === web.cari_adi ? '✓' : '✗)');
            } else if (web.hareket_turu === 'Kasadan K.' || web.hareket_turu === 'Nakit') {
                console.log('Hareket Türü: KASA İŞLEMİ');
                console.log('cha_tpoz: 1 (Gerçek:', erp.cha_tpoz, erp.cha_tpoz === 1 ? '✓' : '✗)');
                console.log('cha_cari_cins: 4 (Gerçek:', erp.cha_cari_cins, erp.cha_cari_cins === 4 ? '✓' : '✗)');
                console.log('cha_grupno: 0 (Gerçek:', erp.cha_grupno, erp.cha_grupno === 0 ? '✓' : '✗)');
            } else {
                console.log('Hareket Türü: AÇIK HESAP');
                console.log('cha_tpoz: 0 (Gerçek:', erp.cha_tpoz, erp.cha_tpoz === 0 ? '✓' : '✗)');
                console.log('cha_cari_cins: 0 (Gerçek:', erp.cha_cari_cins, erp.cha_cari_cins === 0 ? '✓' : '✗)');
                console.log('cha_grupno: 0 (Gerçek:', erp.cha_grupno, erp.cha_grupno === 0 ? '✓' : '✗)');
            }
        }

        // Satış kaydını da kontrol et
        const satisId = '30065755-c800-4fde-a633-96515b6c3c0d';
        const satisRecord = await pgService.query(`
            SELECT hareket_turu, banka_kodu
            FROM satislar
            WHERE id = $1
        `, [satisId]);

        if (satisRecord.length > 0) {
            console.log('\n=== SATIŞLAR TABLOSU ===');
            console.log('hareket_turu:', satisRecord[0].hareket_turu);
            console.log('banka_kodu:', satisRecord[0].banka_kodu);
        }

    } catch (error) {
        console.error('Hata:', error.message);
        console.error(error.stack);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

checkLastOrder();
