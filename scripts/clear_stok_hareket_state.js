const pgService = require('../services/postgresql.service');

async function clearSyncState() {
    try {
        console.log('Clearing sync state for STOK_HAREKETLERI...');
        await pgService.query("DELETE FROM sync_state WHERE tablo_adi = 'STOK_HAREKETLERI'");
        console.log('Sync state cleared.');
    } catch (error) {
        console.error('Failed to clear sync state:', error);
    } finally {
        await pgService.disconnect();
    }
}

clearSyncState();
