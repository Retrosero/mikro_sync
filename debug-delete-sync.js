require('dotenv').config();
const fs = require('fs');
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function debugDeleteSync() {
    const output = [];
    const log = (msg) => {
        console.log(msg);
        output.push(msg);
    };

    log('='.repeat(70));
    log('SİLME SENKRONIZASYONU DEBUG');
    log('='.repeat(70));

    try {
        // 1. MSSQL'deki işlenmemiş silme loglarını al
        log('\n1. MSSQL MIKRO_SYNC_DELETED_LOG tablosu:');
        const deletedLogs = await mssqlService.query(`
            SELECT id, table_name, record_id, deleted_at, processed 
            FROM MIKRO_SYNC_DELETED_LOG 
            ORDER BY deleted_at DESC
        `);
        log(`Toplam ${deletedLogs.length} silme kaydı:`);
        deletedLogs.forEach(l => {
            log(`  - [${l.processed ? 'ISLENDI' : 'BEKLEMEDE'}] ${l.table_name}: ${l.record_id}`);
        });

        // 2. İşlenmemiş olanları filtrele
        const pendingLogs = deletedLogs.filter(l => !l.processed);
        log(`\n${pendingLogs.length} adet islenmeyen kayit var.`);

        // 3. Her bir pending log için Web'de karşılığını ara
        log('\n2. Web veritabaninda eslesme kontrolu:');

        for (const logItem of pendingLogs) {
            log(`\n--- ${logItem.table_name}: ${logItem.record_id} ---`);

            if (logItem.table_name === 'CARI_HESAP_HAREKETLERI') {
                const recno = parseInt(logItem.record_id);

                const byRecno = await pgService.query(
                    'SELECT id, erp_recno, belge_no FROM cari_hesap_hareketleri WHERE erp_recno = $1',
                    [recno]
                );
                log(`  erp_recno = ${recno}: ${byRecno.length} kayit bulundu`);

                const sampleRecnos = await pgService.query(
                    'SELECT erp_recno FROM cari_hesap_hareketleri WHERE erp_recno IS NOT NULL ORDER BY erp_recno DESC LIMIT 5'
                );
                log(`  Son 5 erp_recno ornegi: ${sampleRecnos.map(r => r.erp_recno).join(', ')}`);

            } else if (logItem.table_name === 'STOK_HAREKETLERI') {
                const recno = parseInt(logItem.record_id);

                const byRecno = await pgService.query(
                    'SELECT id, erp_recno, belge_no FROM stok_hareketleri WHERE erp_recno = $1',
                    [recno]
                );
                log(`  erp_recno = ${recno}: ${byRecno.length} kayit bulundu`);

                const sampleRecnos = await pgService.query(
                    'SELECT erp_recno FROM stok_hareketleri WHERE erp_recno IS NOT NULL ORDER BY erp_recno DESC LIMIT 5'
                );
                log(`  Son 5 erp_recno ornegi: ${sampleRecnos.map(r => r.erp_recno).join(', ')}`);
            }
        }

        // 4. ERP'deki mevcut RECno'ları kontrol et
        log('\n3. ERP tarafi RECno kontrolleri:');

        const maxChaRecno = await mssqlService.query('SELECT MAX(cha_RECno) as max_recno FROM CARI_HESAP_HAREKETLERI');
        log(`  CARI_HESAP_HAREKETLERI max RECno: ${maxChaRecno[0].max_recno}`);

        const maxSthRecno = await mssqlService.query('SELECT MAX(sth_RECno) as max_recno FROM STOK_HAREKETLERI');
        log(`  STOK_HAREKETLERI max RECno: ${maxSthRecno[0].max_recno}`);

        // 5. Web'deki max erp_recno
        log('\n4. Web tarafi erp_recno kontrolleri:');

        const webMaxCariRecno = await pgService.query('SELECT MAX(erp_recno) as max_recno FROM cari_hesap_hareketleri');
        log(`  cari_hesap_hareketleri max erp_recno: ${webMaxCariRecno[0].max_recno}`);

        const webMaxStokRecno = await pgService.query('SELECT MAX(erp_recno) as max_recno FROM stok_hareketleri');
        log(`  stok_hareketleri max erp_recno: ${webMaxStokRecno[0].max_recno}`);

        // Dosyaya yaz
        fs.writeFileSync('debug-delete-output.txt', output.join('\n'), 'utf8');
        console.log('\nCikti debug-delete-output.txt dosyasina yazildi.');

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

debugDeleteSync();
