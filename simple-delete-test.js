require('dotenv').config();
const fs = require('fs');
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function simpleTest() {
    const results = [];

    try {
        // Silindi olarak isaretlenmis stok hareketlerini al
        const deletedStok = await mssqlService.query(`
            SELECT record_id FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'STOK_HAREKETLERI' AND processed = 1
        `);

        if (deletedStok.length > 0) {
            const recnos = deletedStok.map(d => parseInt(d.record_id));

            // Web'de bunlar var mi?
            const stillInWeb = await pgService.query(
                `SELECT id, erp_recno FROM stok_hareketleri WHERE erp_recno = ANY($1::int[])`,
                [recnos]
            );

            results.push('=== STOK HAREKETLERI ===');
            results.push('Silindi isaretli: ' + deletedStok.length);
            results.push('Web de hala duran: ' + stillInWeb.length);

            if (stillInWeb.length > 0) {
                results.push('PROBLEM KAYITLARI:');
                stillInWeb.forEach(s => results.push('erp_recno: ' + s.erp_recno + ', id: ' + s.id));
            }
        }

        // Silindi olarak isaretlenmis cari hareketlerini al
        const deletedCari = await mssqlService.query(`
            SELECT record_id FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'CARI_HESAP_HAREKETLERI' AND processed = 1
        `);

        if (deletedCari.length > 0) {
            const recnos = deletedCari.map(d => parseInt(d.record_id));

            const stillInWebCari = await pgService.query(
                `SELECT id, erp_recno FROM cari_hesap_hareketleri WHERE erp_recno = ANY($1::int[])`,
                [recnos]
            );

            results.push('=== CARI HESAP HAREKETLERI ===');
            results.push('Silindi isaretli: ' + deletedCari.length);
            results.push('Web de hala duran: ' + stillInWebCari.length);

            if (stillInWebCari.length > 0) {
                results.push('PROBLEM KAYITLARI:');
                stillInWebCari.forEach(s => results.push('erp_recno: ' + s.erp_recno + ', id: ' + s.id));
            }
        }

        // Dosyaya yaz
        fs.writeFileSync('delete-check-result.txt', results.join('\n'), 'utf8');
        console.log('Sonuclar delete-check-result.txt dosyasina yazildi.');

    } catch (error) {
        console.error('Hata:', error.message);
        results.push('HATA: ' + error.message);
        fs.writeFileSync('delete-check-result.txt', results.join('\n'), 'utf8');
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

simpleTest();
