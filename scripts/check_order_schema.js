const sqlite = require('../services/sqlite.service');

(async () => {
    try {
        console.log('Checking order table schema in SQLite...');
        const schema = sqlite.getTableSchema('order');
        if (schema && schema.length > 0) {
            console.log('Schema found:', schema.map(c => `${c.name} (${c.type})`).join(', '));

            // Query a count to verify table access
            try {
                // Testing quote handling
                const count = sqlite.queryOne("SELECT COUNT(*) as c FROM 'order'");
                console.log('Row count (with quotes):', count);
            } catch (e) {
                console.error('Query with quotes failed:', e.message);
            }

            try {
                // Testing double quote handling
                const count = sqlite.queryOne('SELECT COUNT(*) as c FROM "order"');
                console.log('Row count (with double quotes):', count);
            } catch (e) {
                console.error('Query with double quotes failed:', e.message);
            }
        } else {
            console.error('Table "order" not found or empty schema.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        sqlite.disconnect();
    }
})();
