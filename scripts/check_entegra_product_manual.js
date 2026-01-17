require('dotenv').config();
const pgService = require('../services/postgresql.service');

async function checkEntegraProductManual() {
    try {
        // Tablo yapısını kontrol et
        const columns = await pgService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entegra_product_manual'
            ORDER BY ordinal_position
        `);

        console.log('entegra_product_manual tablo yapısı:');
        console.log(JSON.stringify(columns, null, 2));

        // Belirli kaydı kontrol et
        const record = await pgService.query(`
            SELECT * FROM entegra_product_manual 
            WHERE id = '57987a70-148e-43ca-b748-48c3d31b7606'
        `);

        console.log('\nGüncellenen kayıt:');
        console.log(JSON.stringify(record, null, 2));

        // record_id 19792 kaydını da kontrol et
        const recordById = await pgService.query(`
            SELECT * FROM entegra_product_manual 
            WHERE record_id = 19792
        `);

        console.log('\nrecord_id = 19792 olanlar:');
        console.log(JSON.stringify(recordById, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

checkEntegraProductManual();
