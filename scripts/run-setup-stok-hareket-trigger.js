require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pgService = require('../services/postgresql.service');

async function setupStokHareketTrigger() {
    try {
        console.log('Stok Hareket Trigger\'ı kuruluyor...');

        const sqlPath = path.join(__dirname, 'setup-stok-hareket-trigger.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pgService.query(sql);

        console.log('✓ Trigger başarıyla kuruldu!');

    } catch (error) {
        console.error('Trigger kurulum hatası:', error);
    } finally {
        await pgService.disconnect();
    }
}

setupStokHareketTrigger();
