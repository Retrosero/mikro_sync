require('dotenv').config();
const stockXmlService = require('../services/stock-xml.service');
const mssqlService = require('../services/mssql.service');
const logger = require('../utils/logger');

async function runOnce() {
    try {
        logger.startup();
        logger.info('Stok XML Manuel Çalıştırma Başlatıldı');

        // Veritabanı bağlantısını test et
        await mssqlService.query('SELECT 1');
        logger.info('✓ MS SQL bağlantısı başarılı');

        const generated = await stockXmlService.generateXML();
        if (generated) {
            const uploaded = await stockXmlService.uploadToSSH();
            if (uploaded) {
                logger.info('✅ İşlem başarıyla tamamlandı.');
            } else {
                logger.error('❌ SSH yükleme hatası.');
            }
        } else {
            logger.error('❌ XML oluşturma hatası.');
        }
    } catch (error) {
        logger.error('Beklenmedik hata:', error);
    } finally {
        await mssqlService.disconnect();
        process.exit(0);
    }
}

runOnce();
