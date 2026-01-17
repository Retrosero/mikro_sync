const sqlite3 = require('better-sqlite3');
const dbPath = 'C:/Ana Entegra/db.s3db';
const db = new sqlite3(dbPath, { readonly: true });

const table = 'product';
const columns = db.prepare(`PRAGMA table_info(${table})`).all();
console.log(`Columns of ${table}:`, columns.map(c => c.name).join(', '));
db.close();
