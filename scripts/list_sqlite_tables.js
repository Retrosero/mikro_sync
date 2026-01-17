const sqlite3 = require('better-sqlite3');
const dbPath = 'c:/Users/Gürbüz Oyuncak/Documents/GitHub/mikro_sync/db.s3db';
const db = new sqlite3(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('SQLite Tables:', tables.map(t => t.name).join(', '));
db.close();
