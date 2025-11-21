require('dotenv').config();

const config = {
  server: process.env.MSSQL_SERVER,
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DATABASE,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Eğer kullanıcı adı ve şifre varsa SQL Server Authentication kullan
if (process.env.MSSQL_USER && process.env.MSSQL_PASSWORD) {
  config.user = process.env.MSSQL_USER;
  config.password = process.env.MSSQL_PASSWORD;
  config.authentication = {
    type: 'default'
  };
} else {
  // Yoksa Windows Authentication (Trusted Connection) kullan
  config.authentication = {
    type: 'ntlm',
    options: {
      domain: process.env.MSSQL_DOMAIN || '',
      userName: process.env.MSSQL_WINDOWS_USER || '',
      password: process.env.MSSQL_WINDOWS_PASSWORD || ''
    }
  };
}

module.exports = config;
