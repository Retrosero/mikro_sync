const pg = require('./services/postgresql.service');
async function check() {
  const r = await pg.queryOne('SELECT stok_kodu, katalog_ismi FROM stoklar WHERE stok_kodu = $1', ['004290']);
  console.log(r);
}
check().finally(() => process.exit());
