require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function checkLastRecord() {
    try {
        console.log('Son aktarılan kayıt kontrol ediliyor (Evrak No: 32)...\n');

        // ERP'de kontrol
        await mssqlService.connect();
        const erpRecord = await mssqlService.query(`
            SELECT TOP 1
                cha_RECno, cha_kod, cha_ciro_cari_kodu, cha_aciklama, 
                cha_tpoz, cha_cari_cins, cha_grupno, cha_meblag, cha_evrakno_sira
            FROM CARI_HESAP_HAREKETLERI
            WHERE cha_evrakno_sira = 32
            ORDER BY cha_RECno DESC
        `);

        if (erpRecord.length === 0) {
            console.log('ERP\'de Evrak No 32 bulunamadı!');
            return;
        }

        const erp = erpRecord[0];
        console.log('=== ERP KAYDI (Evrak No: 32) ===');
        console.log('cha_RECno:', erp.cha_RECno);
        console.log('cha_kod:', erp.cha_kod);
        console.log('cha_ciro_cari_kodu:', erp.cha_ciro_cari_kodu);
        console.log('cha_aciklama:', erp.cha_aciklama);
        console.log('cha_tpoz:', erp.cha_tpoz);
        console.log('cha_cari_cins:', erp.cha_cari_cins);
        console.log('cha_grupno:', erp.cha_grupno);
        console.log('cha_meblag:', erp.cha_meblag);

        // Web'de kontrol
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
            console.log('cha_tpoz:', web.cha_tpoz);
            console.log('cha_cari_cins:', web.cha_cari_cins);
            console.log('cha_grupno:', web.cha_grupno);

            console.log('\n=== KARŞILAŞTIRMA ===');
            console.log('cha_tpoz:', `ERP=${erp.cha_tpoz}, Web=${web.cha_tpoz}`, erp.cha_tpoz === web.cha_tpoz ? '✓' : '✗');
            console.log('cha_cari_cins:', `ERP=${erp.cha_cari_cins}, Web=${web.cha_cari_cins}`, erp.cha_cari_cins === web.cha_cari_cins ? '✓' : '✗');
            console.log('cha_grupno:', `ERP=${erp.cha_grupno}, Web=${web.cha_grupno}`, erp.cha_grupno === web.cha_grupno ? '✓' : '✗');
        }

    } catch (error) {
        console.error('Hata:', error.message);
        console.error(error.stack);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

checkLastRecord();
