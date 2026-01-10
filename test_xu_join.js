require('dotenv').config();
const pg = require('./services/postgresql.service');

async function testJoin() {
    try {
        const query = `
            SELECT ep.id, ep."productCode", ep."productName", xu.name 
            FROM entegra_product ep 
            JOIN xmlurunler xu ON ep."productCode" = xu.product_code 
            LIMIT 5
        `;
        const res = await pg.query(query);
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pg.disconnect();
    }
}

testJoin();
