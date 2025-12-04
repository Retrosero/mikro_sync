require('dotenv').config();
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function matchErpRecno() {
    try {
        console.log('Mevcut kayıtlar için erp_recno eşleştirmesi yapılıyor...\n');

        // erp_recno null olan kayıtları al
        const webRecords = await pgService.query(`
            SELECT id, fatura_seri_no, fatura_sira_no, islem_tarihi, tutar
            FROM cari_hesap_hareketleri
            WHERE erp_recno IS NULL
            AND fatura_seri_no IS NOT NULL
            AND fatura_sira_no IS NOT NULL
        `);

        console.log(`${webRecords.length} kayıt eşleştirilecek...`);

        let matched = 0;
        let notFound = 0;

        for (const record of webRecords) {
            // ERP'de eşleşen kaydı bul
            const erpRecord = await mssqlService.query(`
                SELECT TOP 1 cha_RECno
                FROM CARI_HESAP_HAREKETLERI
                WHERE cha_evrakno_seri = @seri
                AND cha_evrakno_sira = @sira
                AND cha_meblag = @tutar
            `, {
                seri: record.fatura_seri_no,
                sira: record.fatura_sira_no,
                tutar: record.tutar
            });

            if (erpRecord.length > 0) {
                // erp_recno güncelle
                await pgService.query(
                    'UPDATE cari_hesap_hareketleri SET erp_recno = $1 WHERE id = $2',
                    [erpRecord[0].cha_RECno, record.id]
                );
                matched++;

                if (matched % 100 === 0) {
                    console.log(`  ${matched} kayıt eşleştirildi...`);
                }
            } else {
                notFound++;
            }
        }

        console.log(`\n✓ Eşleştirme tamamlandı:`);
        console.log(`  - Eşleşen: ${matched}`);
        console.log(`  - Bulunamayan: ${notFound}`);

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

matchErpRecno();
