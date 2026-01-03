/**
 * Bekleyen sync_queue kayıtlarını kontrol eden script
 */

require('dotenv').config();
const pgService = require('./services/postgresql.service');
const fs = require('fs');

async function checkSyncQueue() {
    let output = '';

    try {
        output += 'Bekleyen sync_queue kayitlari kontrol ediliyor...\n\n';

        const result = await pgService.query(`
            SELECT id, entity_type, entity_id, operation, status, error_message, created_at
            FROM sync_queue 
            WHERE status IN ('pending', 'failed', 'processing')
            ORDER BY created_at DESC 
            LIMIT 20
        `);

        if (result.length === 0) {
            output += 'Bekleyen kayit yok.\n';
        } else {
            output += `${result.length} kayit bulundu:\n\n`;
            result.forEach((r, idx) => {
                output += `--- Kayit ${idx + 1} ---\n`;
                output += `  ID: ${r.id}\n`;
                output += `  Entity Type: ${r.entity_type}\n`;
                output += `  Entity ID: ${r.entity_id}\n`;
                output += `  Operation: ${r.operation}\n`;
                output += `  Status: ${r.status}\n`;
                output += `  Error: ${r.error_message || 'Yok'}\n`;
                output += `  Created: ${r.created_at}\n\n`;
            });
        }

        // İstatistikler
        const stats = await pgService.query(`
            SELECT status, COUNT(*) as count
            FROM sync_queue
            GROUP BY status
            ORDER BY count DESC
        `);

        output += '\n--- Istatistikler ---\n';
        stats.forEach(s => {
            output += `  ${s.status}: ${s.count}\n`;
        });

    } catch (error) {
        output += 'Hata: ' + error.message + '\n';
    } finally {
        await pgService.disconnect();

        // Çıktıyı dosyaya yaz
        fs.writeFileSync('sync-queue-status.txt', output);
        console.log('Sonuc sync-queue-status.txt dosyasina yazildi.');
    }
}

checkSyncQueue();
