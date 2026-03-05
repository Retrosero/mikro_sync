const Database = require('better-sqlite3');
const dbPath = 'C:\\Ana Entegra\\db.s3db';
const db = new Database(dbPath, { readonly: true });

const res = db.prepare("SELECT max(id) as max_id FROM 'order'").get();
console.log('SQLite Max Order ID:', res.max_id);

const counts = db.prepare("SELECT count(*) as cnt FROM 'order' WHERE date_add >= '2026-03-03 00:00:00'").get();
console.log('Today/Yesterday Orders in SQLite:', counts.cnt);

db.close();
