require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

// Test sonrası miktarı eski haline getir
sqliteService.connect(false);
sqliteService.run(`UPDATE product_quantity SET quantity = 29 WHERE id = 4`);
console.log('Miktar eski haline getirildi: ID=4, quantity=29');
sqliteService.disconnect();
