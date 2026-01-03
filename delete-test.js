require('dotenv').config();
const fs = require('fs');
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function realTimeDeleteTest() {
    const output = [];
    const log = (msg) => {
        console.log(msg);
        output.push(msg);
    };

    log('='.repeat(70));
    log('GERCEK ZAMANLI SILME TESTI');
    log('='.repeat(70));

    try {
        // 1. ERP'deki son stok hareketini al
        log('\n1. ERP tarafinda bir stok hareketi seciliyor...');
        const erpStokHareket = await mssqlService.query(`
            SELECT TOP 1 sth_RECno, sth_stok_kod, sth_evrakno_sira, sth_tarih
            FROM STOK_HAREKETLERI
            ORDER BY sth_RECno DESC
        `);

        if (erpStokHareket.length === 0) {
            log('ERP de stok hareketi bulunamadi!');
            return;
        }

        const erpRecno = erpStokHareket[0].sth_RECno;
        log(`  ERP Stok Hareketi: RECno=${erpRecno}, Stok=${erpStokHareket[0].sth_stok_kod}`);

        // 2. Bu RECno Web'de var mı kontrol et
        log('\n2. Web tarafinda bu RECno aranıyor...');
        const webStokHareket = await pgService.query(
            'SELECT id, erp_recno, stok_id, belge_no FROM stok_hareketleri WHERE erp_recno = $1',
            [erpRecno]
        );

        if (webStokHareket.length > 0) {
            log(`  BULUNDU! Web ID: ${webStokHareket[0].id}`);
        } else {
            log(`  BULUNAMADI! RECno ${erpRecno} Web de yok.`);
        }

        // 3. Web'deki son 10 erp_recno'yu listele
        log('\n3. Web tarafindaki son 10 stok hareketi erp_recno:');
        const lastWebRecnos = await pgService.query(`
            SELECT id, erp_recno, belge_no, created_at 
            FROM stok_hareketleri 
            WHERE erp_recno IS NOT NULL 
            ORDER BY erp_recno DESC 
            LIMIT 10
        `);
        lastWebRecnos.forEach(r => {
            log(`  RECno: ${r.erp_recno}, Belge: ${r.belge_no}`);
        });

        // 4. Silinmis olarak isaretlenip Web'de hala duran kayitlar var mi?
        log('\n4. Silindi olarak isaretlenip Web de hala duran kayitlar:');
        const deletedLogs = await mssqlService.query(`
            SELECT record_id FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'STOK_HAREKETLERI' AND processed = 1
        `);

        const deletedRecnos = deletedLogs.map(d => parseInt(d.record_id));
        log(`  ${deletedRecnos.length} stok hareketi silindi olarak isaretlenmis.`);

        if (deletedRecnos.length > 0) {
            // Bunların Web'de hala var mı kontrol et
            const stillExist = await pgService.query(
                `SELECT id, erp_recno FROM stok_hareketleri WHERE erp_recno = ANY($1)`,
                [deletedRecnos]
            );

            if (stillExist.length > 0) {
                log(`  PROBLEM! ${stillExist.length} kayit hala Web de duruyor:`);
                stillExist.forEach(s => log(`    - erp_recno: ${s.erp_recno}, id: ${s.id}`));
            } else {
                log(`  OK - Tum silinen kayitlar Web den de kaldirilmis.`);
            }
        }

        // 5. Cari hareketler icin de ayni kontrol
        log('\n5. Cari hareketler icin ayni kontrol:');
        const deletedCariLogs = await mssqlService.query(`
            SELECT record_id FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'CARI_HESAP_HAREKETLERI' AND processed = 1
        `);

        const deletedCariRecnos = deletedCariLogs.map(d => parseInt(d.record_id));
        log(`  ${deletedCariRecnos.length} cari hareketi silindi olarak isaretlenmis.`);

        if (deletedCariRecnos.length > 0) {
            const stillExistCari = await pgService.query(
                `SELECT id, erp_recno FROM cari_hesap_hareketleri WHERE erp_recno = ANY($1)`,
                [deletedCariRecnos]
            );

            if (stillExistCari.length > 0) {
                log(`  PROBLEM! ${stillExistCari.length} cari hareketi hala Web de duruyor:`);
                stillExistCari.forEach(s => log(`    - erp_recno: ${s.erp_recno}, id: ${s.id}`));
            } else {
                log(`  OK - Tum silinen cari hareketler Web den de kaldirilmis.`);
            }
        }

        // Dosyaya yaz
        fs.writeFileSync('delete-test-output.txt', output.join('\n'), 'utf8');
        log('\nCikti delete-test-output.txt dosyasina yazildi.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

realTimeDeleteTest();
