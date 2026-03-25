const pgService = require('./services/postgresql.service');

async function main() {
    try {
        // Satislar tablosundaki trigger'lari kontrol et
        const triggers = await pgService.query(`
            SELECT trigger_name, event_manipulation, action_timing, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'satislar'
            ORDER BY trigger_name
        `);
        console.log('Satislar tablosu triggerlari:');
        console.table(triggers);

        // Tum trigger'lari listele
        const allTriggers = await pgService.query(`
            SELECT trigger_name, event_object_table, event_manipulation, action_timing
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table, trigger_name
        `);
        console.log('\nTum triggerlar:');
        console.table(allTriggers);

    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
