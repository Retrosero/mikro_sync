require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function checkSerhanKayit() {
    try {
        console.log('ERP kontrol ediliyor...\n');

        // Önce SERHAN banka kodu mu kontrol et
        const bankaKontrol = await mssqlService.query(`
            SELECT ban_kod FROM BANKALAR WHERE ban_kod = 'SERHAN'
        `);

        console.log('SERHAN banka kontrolü:');
        if (bankaKontrol.length > 0) {
            console.log('✓ SERHAN bir banka kodudur');
        } else {
            console.log('✗ SERHAN banka kodu değil');
        }

        // Evrak 4552 olan kayıtları bul
        const erpKayit = await mssqlService.query(`
            SELECT TOP 5
                cha_RECno, cha_kod, cha_ciro_cari_kodu, cha_evrakno_sira, 
                cha_evrakno_seri, cha_meblag
            FROM CARI_HESAP_HAREKETLERI
            WHERE cha_evrakno_sira = 4552
        `);

        console.log('\nEvrak 4552 olan kayıtlar:');
        console.table(erpKayit);

        if (erpKayit.length > 0) {
            for (const kayit of erpKayit) {
                console.log(`\n--- Kayıt RECno: ${kayit.cha_RECno} ---`);
                console.log(`cha_kod: "${kayit.cha_kod}"`);
                console.log(`cha_ciro_cari_kodu: "${kayit.cha_ciro_cari_kodu || ''}"`);

                if (kayit.cha_ciro_cari_kodu) {
                    const cariAdi = kayit.cha_ciro_cari_kodu.trim();
                    console.log(`\nWeb'de "${cariAdi}" aranıyor...`);

                    const webCari = await pgService.query(
                        'SELECT id, cari_kodu, cari_adi FROM cari_hesaplar WHERE cari_adi = $1',
                        [cariAdi]
                    );

                    if (webCari.length > 0) {
                        console.log('✓ Cari bulundu:', webCari[0]);

                        // Hareket var mı?
                        const hareket = await pgService.query(
                            'SELECT id, cari_hesap_id, fatura_sira_no, tutar FROM cari_hesap_hareketleri WHERE cari_hesap_id = $1 AND fatura_sira_no = 4552',
                            [webCari[0].id]
                        );

                        if (hareket.length > 0) {
                            console.log('✓ Hareket Web\'de var:', hareket[0]);
                        } else {
                            console.log('✗ Hareket Web\'de YOK!');
                        }
                    } else {
                        console.log('✗ Cari bulunamadı');
                    }
                }
            }
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

checkSerhanKayit();
