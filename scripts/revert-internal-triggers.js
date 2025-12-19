
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pgService = require('../services/postgresql.service');

async function revertTriggers() {
    try {
        console.log('Internal Triggers temizleniyor...');

        const sqlPath = path.join(__dirname, 'revert-internal-triggers.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pgService.query(sql);

        console.log('✓ Internal Triggerlar başarıyla kaldırıldı.');

    } catch (error) {
        console.error('✗ Trigger kaldırma hatası:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

revertTriggers();
