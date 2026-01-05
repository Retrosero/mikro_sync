/**
 * Entegra tablolarını temizler (DROP eder)
 * Test için kullanılır
 */

require('dotenv').config();
const pgService = require('../services/postgresql.service');

const TABLES = [
    'entegra_order',
    'entegra_order_status',
    'entegra_order_product',
    'entegra_pictures',
    'entegra_product_quantity',
    'entegra_product_prices',
    'entegra_product',
    'entegra_product_info',
    'entegra_messages',
    'entegra_message_template'
];

async function cleanTables() {
    console.log('Entegra tabloları temizleniyor...');

    for (const table of TABLES) {
        try {
            await pgService.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
            console.log(`✓ ${table} silindi`);
        } catch (error) {
            console.log(`✗ ${table} silinemedi: ${error.message}`);
        }
    }

    await pgService.disconnect();
    console.log('Tamamlandı');
}

cleanTables();
