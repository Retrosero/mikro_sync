require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function checkRecord() {
    try {
        const recordId = '2e526df8-392c-47b9-9c09-eb7c47163e64';
        console.log(`Kayıt kontrol ediliyor: ${recordId}\n`);

        // Web'de kontrol
        await pgService.connect();
        const webRecord = await pgService.query(`
            SELECT ch.*, c.cari_adi, c.cari_kodu, s.hareket_turu as satis_hareket_turu, s.banka_kodu as satis_banka_kodu
            FROM cari_hesap_hareketleri ch
            LEFT JOIN cari_hesaplar c ON c.id = ch.cari_hesap_id
            LEFT JOIN satislar s ON s.id::text = ch.belge_no
            WHERE ch.id = $1
        `, [recordId]);

        if (webRecord.length === 0) {
            console.log('Web\'de kayıt bulunamadı!');
            return;
        }

        const web = webRecord[0];
        console.log('=== WEB KAYDI ===');
        console.log('ID:', web.id);
        console.log('erp_recno:', web.erp_recno);
        console.log('cha_recno:', web.cha_recno);
        console.log('cari_hesap_id:', web.cari_hesap_id);
        console.log('cari_adi:', web.cari_adi);
        console.log('cari_kodu:', web.cari_kodu);
        console.log('tutar:', web.tutar);
        console.log('hareket_tipi:', web.hareket_tipi);
        console.log('hareket_turu:', web.hareket_turu);
        console.log('banka_kodu:', web.banka_kodu);
        console.log('belge_no:', web.belge_no);
        console.log('satis_hareket_turu:', web.satis_hareket_turu);
        console.log('satis_banka_kodu:', web.satis_banka_kodu);

        if (web.erp_recno) {
            // ERP'de kontrol
            await mssqlService.connect();
            const erpRecord = await mssqlService.query(`
                SELECT cha_RECno, cha_kod, cha_ciro_cari_kodu, cha_aciklama, 
                       cha_tpoz, cha_cari_cins, cha_grupno, cha_meblag, cha_evrakno_sira
                FROM CARI_HESAP_HAREKETLERI
                WHERE cha_RECno = @recno
            `, { recno: web.erp_recno });

            if (erpRecord.length > 0) {
                const erp = erpRecord[0];
                console.log('\n=== ERP KAYDI ===');
                console.log('cha_RECno:', erp.cha_RECno);
                console.log('cha_kod:', erp.cha_kod);
                console.log('cha_ciro_cari_kodu:', erp.cha_ciro_cari_kodu);
                console.log('cha_aciklama:', erp.cha_aciklama);
                console.log('cha_tpoz:', erp.cha_tpoz);
                console.log('cha_cari_cins:', erp.cha_cari_cins);
                console.log('cha_grupno:', erp.cha_grupno);
                console.log('cha_meblag:', erp.cha_meblag);

                console.log('\n=== MAPPING KONTROLÜ ===');

                // Beklenen değerler
                let expectedChaKod, expectedChaCiroCariKodu, expectedChaAciklama, expectedChaTpoz, expectedChaCariCins, expectedChaGrupno;

                if (web.hareket_turu === 'Bankadan K.' || web.hareket_turu === 'Kredi Kartı' || web.hareket_turu === 'Havale') {
                    console.log('Beklenen: BANKA İŞLEMİ');
                    expectedChaKod = web.banka_kodu || web.satis_banka_kodu || '(Banka Kodu)';
                    expectedChaCiroCariKodu = web.cari_kodu;
                    expectedChaAciklama = web.cari_adi;
                    expectedChaTpoz = 1;
                    expectedChaCariCins = 2;
                    expectedChaGrupno = 1;
                } else if (web.hareket_turu === 'Kasadan K.' || web.hareket_turu === 'Nakit') {
                    console.log('Beklenen: KASA İŞLEMİ');
                    expectedChaKod = web.banka_kodu || web.satis_banka_kodu || '(Kasa Kodu)';
                    expectedChaCiroCariKodu = web.cari_kodu;
                    expectedChaAciklama = web.cari_adi;
                    expectedChaTpoz = 1;
                    expectedChaCariCins = 4;
                    expectedChaGrupno = 0;
                } else {
                    console.log('Beklenen: AÇIK HESAP');
                    expectedChaKod = web.cari_kodu;
                    expectedChaCiroCariKodu = '';
                    expectedChaAciklama = '(Notlar)';
                    expectedChaTpoz = 0;
                    expectedChaCariCins = 0;
                    expectedChaGrupno = 0;
                }

                console.log('\nBeklenen Değerler:');
                console.log('  cha_kod:', expectedChaKod);
                console.log('  cha_ciro_cari_kodu:', expectedChaCiroCariKodu);
                console.log('  cha_aciklama:', expectedChaAciklama);
                console.log('  cha_tpoz:', expectedChaTpoz);
                console.log('  cha_cari_cins:', expectedChaCariCins);
                console.log('  cha_grupno:', expectedChaGrupno);

                console.log('\nGerçek Değerler:');
                console.log('  cha_kod:', erp.cha_kod, erp.cha_kod === expectedChaKod ? '✓' : '✗');
                console.log('  cha_ciro_cari_kodu:', erp.cha_ciro_cari_kodu, erp.cha_ciro_cari_kodu === expectedChaCiroCariKodu ? '✓' : '✗');
                console.log('  cha_aciklama:', erp.cha_aciklama, erp.cha_aciklama === expectedChaAciklama ? '✓' : '✗');
                console.log('  cha_tpoz:', erp.cha_tpoz, erp.cha_tpoz === expectedChaTpoz ? '✓' : '✗');
                console.log('  cha_cari_cins:', erp.cha_cari_cins, erp.cha_cari_cins === expectedChaCariCins ? '✓' : '✗');
                console.log('  cha_grupno:', erp.cha_grupno, erp.cha_grupno === expectedChaGrupno ? '✓' : '✗');
            } else {
                console.log('\nERP\'de kayıt bulunamadı!');
            }
        } else {
            console.log('\nerp_recno NULL - ERP\'ye henüz gönderilmemiş');
        }

    } catch (error) {
        console.error('Hata:', error.message);
        console.error(error.stack);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

checkRecord();
