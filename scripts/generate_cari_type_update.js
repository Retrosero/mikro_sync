const mssql = require('../services/mssql.service');
const fs = require('fs');
const path = require('path');

async function generate() {
    try {
        const records = await mssql.query(`
            SELECT 
                cari_kod, 
                cari_baglanti_tipi 
            FROM CARI_HESAPLAR
        `);

        console.log(`${records.length} kayıt için tip güncelleme SQL'i hazırlanıyor...`);

        let sql = `-- SADECE MÜŞTERİ TİPİ GÜNCELLEME SQL\n`;
        sql += `-- Toplam Kayıt: ${records.length}\n\n`;

        sql += `UPDATE cari_hesaplar AS c
SET cari_tipi = v.yeni_tip,
    guncelleme_tarihi = NOW()
FROM (VALUES \n`;

        const rows = records.map(r => {
            const escape = (str) => str ? str.replace(/'/g, "''").trim() : '';
            const tipi = r.cari_baglanti_tipi === 1 ? 'Tedarikçi' : 'Müşteri';
            return `('${escape(r.cari_kod)}', '${tipi}')`;
        });

        sql += rows.join(',\n') + '\n';

        sql += `) AS v(cari_kodu, yeni_tip)
WHERE c.cari_kodu = v.cari_kodu;`;

        const filePath = path.join(__dirname, 'update_cari_tipleri.sql');
        fs.writeFileSync(filePath, sql);
        console.log(`✓ SQL dosyası oluşturuldu: ${filePath}`);

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        process.exit();
    }
}

generate();
