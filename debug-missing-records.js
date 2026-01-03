require('dotenv').config();
const fs = require('fs');
const pgService = require('./services/postgresql.service');
const mssqlService = require('./services/mssql.service');

async function debugMissingRecords() {
    const results = [];

    try {
        // Test edilecek RECno'lar
        const cariRecno = 71795;
        const stokRecno = 136886;

        results.push('=== DEBUG: BULUNAMAYAN KAYITLAR ===\n');

        // 1. Web'de cari hareket ara
        results.push('1. CARI HAREKET KONTROLU (RECno: ' + cariRecno + ')');
        const cariInWeb = await pgService.query(
            'SELECT id, erp_recno, belge_no FROM cari_hesap_hareketleri WHERE erp_recno = $1',
            [cariRecno]
        );
        results.push('   Web\'de bulundu mu: ' + (cariInWeb.length > 0 ? 'EVET' : 'HAYIR'));

        // ERP'de bu kayit var mi (silinmis olmali)
        const cariInERP = await mssqlService.query(
            'SELECT cha_RECno FROM CARI_HESAP_HAREKETLERI WHERE cha_RECno = @recno',
            { recno: cariRecno }
        );
        results.push('   ERP\'de bulundu mu: ' + (cariInERP.length > 0 ? 'EVET (henuz silinmemis)' : 'HAYIR (silinmis)'));

        // Web'deki max erp_recno
        const maxCariRecno = await pgService.query('SELECT MAX(erp_recno) as max_recno FROM cari_hesap_hareketleri');
        results.push('   Web\'deki max erp_recno: ' + maxCariRecno[0].max_recno);
        results.push('   Aranan recno: ' + cariRecno);
        results.push('   Fark: ' + (cariRecno - maxCariRecno[0].max_recno));

        results.push('\n2. STOK HAREKET KONTROLU (RECno: ' + stokRecno + ')');
        const stokInWeb = await pgService.query(
            'SELECT id, erp_recno, belge_no FROM stok_hareketleri WHERE erp_recno = $1',
            [stokRecno]
        );
        results.push('   Web\'de bulundu mu: ' + (stokInWeb.length > 0 ? 'EVET' : 'HAYIR'));

        const stokInERP = await mssqlService.query(
            'SELECT sth_RECno FROM STOK_HAREKETLERI WHERE sth_RECno = @recno',
            { recno: stokRecno }
        );
        results.push('   ERP\'de bulundu mu: ' + (stokInERP.length > 0 ? 'EVET (henuz silinmemis)' : 'HAYIR (silinmis)'));

        const maxStokRecno = await pgService.query('SELECT MAX(erp_recno) as max_recno FROM stok_hareketleri');
        results.push('   Web\'deki max erp_recno: ' + maxStokRecno[0].max_recno);
        results.push('   Aranan recno: ' + stokRecno);
        results.push('   Fark: ' + (stokRecno - maxStokRecno[0].max_recno));

        results.push('\n3. SONUC:');
        if (cariRecno > maxCariRecno[0].max_recno || stokRecno > maxStokRecno[0].max_recno) {
            results.push('   Bu kayitlar Web\'e HICBIR ZAMAN senkronize edilmemis!');
            results.push('   Cunku ERP\'de olusturulup, Web senkronizasyonundan ONCE silindi.');
        }

        fs.writeFileSync('debug-missing-result.txt', results.join('\n'), 'utf8');
        console.log('Sonuclar debug-missing-result.txt dosyasina yazildi');

    } catch (error) {
        console.error('Hata:', error.message);
        results.push('HATA: ' + error.message);
        fs.writeFileSync('debug-missing-result.txt', results.join('\n'), 'utf8');
    } finally {
        await pgService.disconnect();
        await mssqlService.disconnect();
    }
}

debugMissingRecords();
