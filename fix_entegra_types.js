require('dotenv').config();
const pg = require('./services/postgresql.service');

async function fixColumnTypes() {
    try {
        const columns = await pg.query(`
            SELECT table_name, column_name 
            FROM information_schema.columns 
            WHERE table_name LIKE 'entegra_%' 
            AND data_type = 'integer' 
            AND table_schema = 'public'
        `);

        console.log(`${columns.length} adet INTEGER kolon bulundu. BIGINT'e çevriliyor...`);

        for (const col of columns) {
            console.log(`Güncelleniyor: ${col.table_name}.${col.column_name}`);
            await pg.query(`ALTER TABLE "${col.table_name}" ALTER COLUMN "${col.column_name}" TYPE BIGINT`);
        }

        console.log('Tüm kolonlar başarıyla güncellendi.');
    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pg.disconnect();
    }
}

fixColumnTypes();
