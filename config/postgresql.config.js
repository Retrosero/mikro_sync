require('dotenv').config();

module.exports = {
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  // SSL - Supabase için gerekli
  ssl: process.env.PG_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  // Connection Pool
  max: parseInt(process.env.PG_MAX_CONNECTIONS || '10'),
  min: 2,
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '60000'),
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '60000'),
  // Supabase için özel ayarlar
  statement_timeout: 120000, // 120 saniye
  query_timeout: 120000,
  application_name: 'mikro_sync',
  // Keepalive - Supabase bağlantısını canlı tutar
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};
