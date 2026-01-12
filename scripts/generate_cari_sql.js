const mssql = require('../services/mssql.service');
const fs = require('fs');
const path = require('path');

async function generate() {
    try {
        const records = await mssql.query(`
            SELECT 
                cari_kod, 
                (cari_unvan1 + ' ' + ISNULL(cari_unvan2, '')) as cari_adi, 
                cari_CepTel, 
                cari_EMail, 
                cari_vdaire_adi, 
                cari_vdaire_no, 
                cari_baglanti_tipi 
            FROM CARI_HESAPLAR
        `);

        console.log(`${records.length} kayıt işleniyor...`);

        let sql = `-- CARİ HESAPLAR TOPLU AKTARIM SQL (ERP -> WEB)\n`;
        sql += `-- Toplam Kayıt: ${records.length}\n`;
        sql += `-- Oluşturma Tarihi: ${new Date().toLocaleString()}\n\n`;

        sql += `INSERT INTO cari_hesaplar (
    cari_kodu, cari_adi, telefon, eposta, vergi_dairesi, vergi_no, cari_tipi, kaynak, guncelleme_tarihi
) VALUES \n`;

        const rows = records.map(r => {
            const escape = (str) => str ? str.replace(/'/g, "''").trim() : '';
            const tipi = r.cari_baglanti_tipi === 1 ? 'Tedarikçi' : 'Müşteri';

            return `('${escape(r.cari_kod)}', '${escape(r.cari_adi)}', '${escape(r.cari_CepTel)}', '${escape(r.cari_EMail)}', '${escape(r.cari_vdaire_adi)}', '${escape(r.cari_vdaire_no)}', '${tipi}', 'erp', NOW())`;
        });

        sql += rows.join(',\n') + '\n';

        sql += `ON CONFLICT (cari_kodu) DO UPDATE SET
    cari_adi = EXCLUDED.cari_adi,
    telefon = EXCLUDED.telefon,
    eposta = EXCLUDED.eposta,
    vergi_dairesi = EXCLUDED.vergi_dairesi,
    vergi_no = EXCLUDED.vergi_no,
    cari_tipi = EXCLUDED.cari_tipi,
    kaynak = EXCLUDED.kaynak,
    guncelleme_tarihi = NOW();`;

        const filePath = path.join(__dirname, 'all_cariler_web.sql');
        fs.writeFileSync(filePath, sql);
        console.log(`✓ SQL dosyası oluşturuldu: ${filePath}`);

    } catch (err) {
        console.error('Hata:', err);
    } finally {
        process.exit();
    }
}

generate();
