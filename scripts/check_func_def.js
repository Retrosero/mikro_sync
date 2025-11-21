const pgService = require('../services/postgresql.service');

async function checkFuncDef() {
    try {
        const result = await pgService.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc
      WHERE proname = 'update_stok_durumu'
    `);

        if (result.length > 0) {
            console.log('Function Definition:');
            console.log(result[0].def);
        } else {
            console.log('Function not found');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

checkFuncDef();
