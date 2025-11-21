const pgService = require('../services/postgresql.service');
const fs = require('fs');

async function saveFuncDef() {
    try {
        const result = await pgService.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc
      WHERE proname = 'update_stok_durumu'
    `);

        if (result.length > 0) {
            fs.writeFileSync('func_def.sql', result[0].def);
            console.log('Function definition saved to func_def.sql');
        } else {
            console.log('Function not found');
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await pgService.disconnect();
    }
}

saveFuncDef();
