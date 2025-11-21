const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const config = require('../config/mssql.config');

async function createERPMappingTables() {
    try {
        console.log('MS SQL Server bağlantısı kuruluyor...');
        await sql.connect(config);
        console.log('✓ Bağlantı başarılı');

        const sqlFile = path.join(__dirname, 'create_erp_mapping_tables.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        // SQL scriptini satırlara böl ve GO komutlarına göre ayır
        const batches = sqlContent.split(/\bGO\b/gi).filter(batch => batch.trim());

        console.log('Mapping tabloları oluşturuluyor...');
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i].trim();
            if (batch) {
                try {
                    const result = await sql.query(batch);
                    if (result.recordset && result.recordset.length > 0) {
                        result.recordset.forEach(row => {
                            if (row['']) console.log(row['']);
                        });
                    }
                } catch (err) {
                    console.error(`Batch ${i + 1} hatası:`, err.message);
                }
            }
        }
        console.log('✓ Mapping tabloları başarıyla oluşturuldu!');

    } catch (error) {
        console.error('Hata:', error.message);
        process.exit(1);
    } finally {
        await sql.close();
    }
}

createERPMappingTables();
