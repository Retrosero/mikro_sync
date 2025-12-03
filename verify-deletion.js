require('dotenv').config();
const mssqlService = require('./services/mssql.service');
const pgService = require('./services/postgresql.service');

async function verifyDeletion() {
    try {
        console.log('SILME SENKRONIZASYONU DOGRULAMA');
        console.log('='.repeat(50));

        // 1. MSSQL log tablosunu kontrol et
        const logs = await mssqlService.query(`
            SELECT * FROM MIKRO_SYNC_DELETED_LOG 
            WHERE table_name = 'CARI_HESAP_HAREKETLERI'
            ORDER BY deleted_at DESC
        `);

        console.log(`\nMSSQL Log kayit sayisi: ${logs.length}`);
        if (logs.length > 0) {
            console.log('Son kayit:');
            console.log(`  RECno: ${logs[0].record_id}`);
            console.log(`  Processed: ${logs[0].processed ? 'EVET' : 'HAYIR'}`);

            // 2. Web'de bu kaydın olup olmadığını kontrol et
            const webCheck = await pgService.query(`
                SELECT COUNT(*) as cnt 
                FROM cari_hesap_hareketleri 
                WHERE erp_recno = $1
            `, [parseInt(logs[0].record_id)]);

            console.log(`\nWeb'de kayit var mi: ${webCheck[0].cnt > 0 ? 'EVET' : 'HAYIR'}`);

            if (logs[0].processed && webCheck[0].cnt === 0) {
                console.log('\nSONUC: BASARILI!');
                console.log('Hareket MSSQL\'den silindi, Web\'den de silindi.');
            } else if (!logs[0].processed) {
                console.log('\nSONUC: BEKLEMEDE');
                console.log('Log kaydedildi ama henuz islenmedi.');
            } else {
                console.log('\nSONUC: SORUNLU');
                console.log('Log islendi ama Web\'de hala kayit var.');
            }
        }

        console.log('\n' + '='.repeat(50));

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
        await pgService.disconnect();
    }
}

verifyDeletion();
