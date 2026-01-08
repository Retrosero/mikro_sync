require('dotenv').config();
const invoiceSettingsService = require('../services/invoice-settings.service');
const pgService = require('../services/postgresql.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

async function test() {
    console.log('\n===================================================');
    console.log('Fatura Sıra No Senkronizasyonu Test Ediliyor...');
    console.log('===================================================\n');

    try {
        await invoiceSettingsService.syncInvoiceNumbers();
        console.log('\n✅ Test başarıyla tamamlandı.');
    } catch (error) {
        console.error('\n❌ Test sırasında hata oluştu:', error.message);
    } finally {
        // Bağlantıları kapat
        await pgService.disconnect();
        await mssqlService.disconnect();
        process.exit();
    }
}

test();
