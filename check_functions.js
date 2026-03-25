const pgService = require('./services/postgresql.service');

async function main() {
    try {
        // Trigger fonksiyonlarini listele
        const funcs = await pgService.query(`
            SELECT routine_name, routine_definition
            FROM information_schema.routines
            WHERE routine_type = 'FUNCTION'
            AND routine_schema = 'public'
            AND routine_name LIKE '%sync%'
            ORDER BY routine_name
        `);
        console.log('Sync fonksiyonlari:');
        funcs.forEach(f => {
            console.log('\n===', f.routine_name, '===');
            console.log(f.routine_definition ? f.routine_definition.substring(0, 1000) + '...' : 'NULL');
        });
    } catch (e) {
        console.error(e);
    } finally {
        await pgService.disconnect();
    }
}

main();
