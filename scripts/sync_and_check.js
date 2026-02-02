/**
 * Sync ve kontrol işlemini otomatik yapan script
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function syncAndCheck() {
    try {
        console.log('1. Sync başlatılıyor...\n');
        const { stdout: syncOut } = await execPromise('node web-to-erp-sync.js sync');
        console.log(syncOut);

        console.log('\n2. Sonuç kontrol ediliyor...\n');
        const { stdout: checkOut } = await execPromise('node scripts/check_st52.js');
        console.log(checkOut);

    } catch (error) {
        console.error('Hata:', error.message);
    }
}

syncAndCheck();
