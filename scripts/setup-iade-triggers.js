
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pgService = require('../services/postgresql.service');

async function setupTriggers() {
    try {
        console.log('İade Triggers kuruluyor...');

        const sqlPath = path.join(__dirname, 'setup-iade-triggers.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await pgService.query(sql);

        console.log('✓ İade Triggerları başarıyla kuruldu!');

    } catch (error) {
        console.error('✗ Trigger kurulum hatası:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

setupTriggers();
