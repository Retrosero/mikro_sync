require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function checkLastSaleSync() {
    try {
        console.log('Checking last sale in Web...');
        // 1. Get latest sale from Web
        const webSales = await pgService.query(`
            SELECT id, satis_tarihi, toplam_tutar, cari_hesap_id, fatura_seri_no, fatura_sira_no, hareket_turu, banka_id, banka_kodu, kasa_id, kasa_kodu
            FROM satislar 
            ORDER BY olusturma_tarihi DESC 
            LIMIT 1
        `);

        if (webSales.length === 0) {
            console.log('No sales found in Web.');
            return;
        }

        const sale = webSales[0];
        console.log('Latest Web Sale:', {
            id: sale.id,
            tarih: sale.satis_tarihi,
            tutar: sale.toplam_tutar,
            cari_id: sale.cari_hesap_id,
            hareket_turu: sale.hareket_turu,
            banka_id: sale.banka_id,
            banka_kodu: sale.banka_kodu,
            kasa_id: sale.kasa_id,
            kasa_kodu: sale.kasa_kodu,
            evrak: (sale.fatura_seri_no || '') + (sale.fatura_sira_no || '')
        });

        // 2. Fetch related cari_hesap_hareketleri in Web
        const webMovements = await pgService.query(`
            SELECT id, hareket_turu, banka_id, banka_kodu, kasa_id, kasa_kodu, erp_recno, cha_recno
            FROM cari_hesap_hareketleri
            WHERE belge_no = $1
        `, [sale.id.toString()]);

        console.log('Web Cari Hareketleri:', webMovements);

        // 3. Check ERP Record
        // We need the Evrak No to find it in ERP. It's stored in int_satis_mapping or we guess it.
        const mapping = await pgService.query(`
            SELECT erp_evrak_seri, erp_evrak_no 
            FROM int_satis_mapping 
            WHERE web_satis_id = $1
        `, [sale.id]);

        let erpRecord = null;
        if (mapping.length > 0) {
            console.log('Mapping found:', mapping[0]);
            const seri = mapping[0].erp_evrak_seri;
            const no = mapping[0].erp_evrak_no;

            const erpQuery = `
                SELECT TOP 1 cha_kod, cha_ciro_cari_kodu, cha_meblag, cha_aciklama, cha_tpoz, cha_cari_cins, cha_grupno
                FROM CARI_HESAP_HAREKETLERI
                WHERE cha_evrakno_seri = @seri AND cha_evrakno_sira = @no AND cha_evrak_tip = 63
            `;
            const erpResult = await mssqlService.query(erpQuery, { seri, no });
            if (erpResult.length > 0) {
                erpRecord = erpResult[0];
            }
        } else {
            console.log('No mapping found. Searching ERP by amount and date...');
            // Fallback search
            const erpQuery = `
                SELECT TOP 3 cha_kod, cha_ciro_cari_kodu, cha_meblag, cha_aciklama, cha_tpoz, cha_cari_cins, cha_grupno, cha_evrakno_seri, cha_evrakno_sira
                FROM CARI_HESAP_HAREKETLERI
                WHERE cha_meblag = @tutar AND cha_tarihi = @tarih AND cha_evrak_tip = 63
                ORDER BY cha_create_date DESC
            `;
            const erpResult = await mssqlService.query(erpQuery, { tutar: sale.toplam_tutar, tarih: sale.satis_tarihi });
            if (erpResult.length > 0) {
                erpRecord = erpResult[0];
                console.log('Found potential match in ERP:', erpRecord);
            }
        }

        if (erpRecord) {
            console.log('ERP Record:', erpRecord);
            console.log('--------------------------------------------------');
            console.log('VERIFICATION:');
            console.log('Expected cha_kod (Banka/Kasa):', sale.banka_kodu || sale.kasa_kodu || 'N/A');
            console.log('Actual   cha_kod:', erpRecord.cha_kod);
            console.log('Expected cha_ciro_cari_kodu (Cari):', 'Should be Customer Code');
            console.log('Actual   cha_ciro_cari_kodu:', erpRecord.cha_ciro_cari_kodu);

            if (sale.banka_kodu && erpRecord.cha_kod !== sale.banka_kodu) {
                console.log('FAIL: cha_kod does not match banka_kodu.');
            } else if (sale.kasa_kodu && erpRecord.cha_kod !== sale.kasa_kodu) {
                console.log('FAIL: cha_kod does not match kasa_kodu.');
            } else {
                console.log('PASS: cha_kod seems correct (or n/a).');
            }
        } else {
            console.log('ERP Record NOT found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
        // mssql disconnect isn't strictly needed as script ends, but good practice if available
    }
}

checkLastSaleSync();
