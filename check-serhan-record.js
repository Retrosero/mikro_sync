require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function checkSerhanRecord() {
    try {
        console.log('SERHAN kodlu carinin 1650 TL tutarlı fişi kontrol ediliyor...\n');

        // ERP'de kontrol
        await mssqlService.connect();
        const erpRecords = await mssqlService.query(`
            SELECT TOP 5
                cha_RECno, cha_tarihi, cha_kod, cha_ciro_cari_kodu, cha_meblag, 
                cha_aciklama, cha_tpoz, cha_cari_cins, cha_grupno, cha_evrakno_sira
            FROM CARI_HESAP_HAREKETLERI
            WHERE (cha_kod = 'SERHAN' OR cha_ciro_cari_kodu = 'SERHAN')
            AND cha_meblag = 1650
            ORDER BY cha_tarihi DESC
        `);

        console.log('ERP Kayıtları:');
        console.table(erpRecords);

        if (erpRecords.length > 0) {
            const erpRec = erpRecords[0];
            console.log('\nERP Detay:');
            console.log('cha_RECno:', erpRec.cha_RECno);
            console.log('cha_kod:', erpRec.cha_kod);
            console.log('cha_ciro_cari_kodu:', erpRec.cha_ciro_cari_kodu);
            console.log('cha_aciklama:', erpRec.cha_aciklama);
            console.log('cha_tpoz:', erpRec.cha_tpoz);
            console.log('cha_cari_cins:', erpRec.cha_cari_cins);
            console.log('cha_grupno:', erpRec.cha_grupno);

            // Web'de kontrol
            const webRecords = await pgService.query(`
                SELECT id, erp_recno, cha_recno, cari_hesap_id, islem_tarihi, 
                       belge_no, tutar, hareket_tipi, hareket_turu, banka_kodu
                FROM cari_hesap_hareketleri
                WHERE erp_recno = $1 OR tutar = 1650
                ORDER BY guncelleme_tarihi DESC
                LIMIT 5
            `, [erpRec.cha_RECno]);

            console.log('\nWeb Kayıtları:');
            console.table(webRecords);

            if (webRecords.length > 0) {
                const webRec = webRecords[0];
                console.log('\nWeb Detay:');
                console.log('erp_recno:', webRec.erp_recno);
                console.log('cha_recno:', webRec.cha_recno);
                console.log('hareket_tipi:', webRec.hareket_tipi);
                console.log('hareket_turu:', webRec.hareket_turu);
                console.log('banka_kodu:', webRec.banka_kodu);

                // Mapping kontrolü
                console.log('\n=== MAPPING KONTROLÜ ===');
                console.log('ERP -> Web mapping doğru mu?');
                if (erpRec.cha_tpoz === 1 && erpRec.cha_cari_cins === 4) {
                    console.log('✓ ERP: Kasa işlemi (cha_tpoz=1, cha_cari_cins=4)');
                    console.log('  Web hareket_turu:', webRec.hareket_turu, '(Beklenen: Kasadan K. veya Nakit)');
                } else if (erpRec.cha_tpoz === 1 && erpRec.cha_cari_cins === 2) {
                    console.log('✓ ERP: Banka işlemi (cha_tpoz=1, cha_cari_cins=2)');
                    console.log('  Web hareket_turu:', webRec.hareket_turu, '(Beklenen: Bankadan K., Kredi Kartı, Havale)');
                } else {
                    console.log('✓ ERP: Açık hesap (cha_tpoz=0)');
                    console.log('  Web hareket_turu:', webRec.hareket_turu, '(Beklenen: Açık Hesap)');
                }

                console.log('\nERP alanları:');
                console.log('  cha_kod:', erpRec.cha_kod, '(Beklenen: Banka/Kasa kodu veya Müşteri kodu)');
                console.log('  cha_ciro_cari_kodu:', erpRec.cha_ciro_cari_kodu, '(Beklenen: Müşteri kodu veya Boş)');
                console.log('  cha_aciklama:', erpRec.cha_aciklama, '(Beklenen: Müşteri adı veya Notlar)');
            }
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

checkSerhanRecord();
