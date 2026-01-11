require('dotenv').config();
const pg = require('./services/postgresql.service');

async function fixConstraints() {
    try {
        console.log('Checking constraints for xmlurunler...');
        const constraints = await pg.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'xmlurunler' AND constraint_type = 'UNIQUE'
        `);
        console.log('Current UNIQUE constraints:', constraints);

        if (constraints.find(c => c.constraint_name === 'xmlurunler_barcode_key')) {
            console.log('Dropping xmlurunler_barcode_key constraint...');
            await pg.query('ALTER TABLE xmlurunler DROP CONSTRAINT xmlurunler_barcode_key');
            console.log('Constraint dropped successfully.');
        } else {
            console.log('xmlurunler_barcode_key constraint not found.');
        }
    } catch (e) {
        console.error('Error fixing constraints:', e);
    } finally {
        await pg.disconnect();
    }
}

fixConstraints();
