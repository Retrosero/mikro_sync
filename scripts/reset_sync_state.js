const syncStateService = require('../services/sync-state.service');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function resetSyncState() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ⚠️  SYNC STATE SIFIRLAMA');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('Bu işlem tüm sync state kayıtlarını siler.');
    console.log('Sonraki senkronizasyon TAM senkronizasyon olacak!\n');

    const answer = await question('Devam etmek istiyor musunuz? (evet/hayır): ');

    if (answer.toLowerCase() !== 'evet') {
        console.log('İşlem iptal edildi.');
        rl.close();
        return;
    }

    try {
        await syncStateService.resetAllSyncStates();
        console.log('\n✅ Tüm sync state kayıtları silindi!');
        console.log('👉 Sonraki çalıştırmada tüm veriler yeniden aktarılacak.\n');
    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        rl.close();
    }
}

resetSyncState();
