require('dotenv').config();
const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function getTriggerFunction() {
    try {
        // PostgreSQL'deki sync_queue ile ilgili tüm trigger fonksiyonlarını al
        const functions = await pgService.query(`
            SELECT 
                proname as name,
                prosrc as source
            FROM pg_proc
            WHERE prosrc LIKE '%sync_queue%'
        `);

        let output = '=== SYNC_QUEUE TRIGGER FONKSIYONLARI ===\n\n';

        functions.forEach((f, i) => {
            output += `--- FONKSIYON ${i + 1}: ${f.name} ---\n`;
            output += f.source + '\n\n';
        });

        // Tüm tablolarda sync_queue trigger'ını kontrol et
        const triggers = await pgService.query(`
            SELECT 
                t.tgname as trigger_name,
                c.relname as table_name,
                p.proname as function_name
            FROM pg_trigger t
            JOIN pg_class c ON t.tgrelid = c.oid
            JOIN pg_proc p ON t.tgfoid = p.oid
            WHERE p.prosrc LIKE '%sync_queue%'
            AND NOT t.tgisinternal
            ORDER BY c.relname
        `);

        output += '\n=== SYNC_QUEUE TRIGGER KULLANAN TABLOLAR ===\n\n';
        triggers.forEach(t => {
            output += `Tablo: ${t.table_name} | Trigger: ${t.trigger_name} | Fonksiyon: ${t.function_name}\n`;
        });

        // Dosyaya yaz
        fs.writeFileSync('trigger_functions.txt', output, 'utf8');
        console.log('Sonuclar trigger_functions.txt dosyasina yazildi.');
        console.log('\nBulunan fonksiyon sayisi:', functions.length);
        console.log('Bulunan trigger sayisi:', triggers.length);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        await pgService.disconnect();
        process.exit(0);
    }
}

getTriggerFunction();
