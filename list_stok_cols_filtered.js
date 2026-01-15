const pg = require('./services/postgresql.service');

async function listColumns() {
    try {
        const res = await pg.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stoklar'
        `);
        // Filtreleme yapalım
        const filtered = res.map(r => r.column_name).filter(c =>
            c.includes('asorti') ||
            c.includes('tip') ||
            c.includes('type') ||
            c.includes('kind') ||
            c.includes('main') ||
            c.includes('ana') ||
            c.includes('is_')
        );
        console.log('Olası Asorti Kolonları:', filtered);
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

listColumns();
