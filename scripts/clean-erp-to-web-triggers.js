require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');
const path = require('path');

async function cleanERPToWebTriggers() {
    try {
        console.log('Eski ERP->Web Trigger''ları Temizleniyor...');
        console.log('='.repeat(70));

        const sql = fs.readFileSync(
            path.join(__dirname, 'clean-erp-to-web-triggers.sql'),
            'utf8'
        );

        await pgService.query(sql);

        console.log('✓ Eski trigger''lar temizlendi!');
        console.log('='.repeat(70));

    } catch (error) {
        console.error('✗ Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

cleanERPToWebTriggers();
