require('dotenv').config();
const sqliteService = require('../services/sqlite.service');

// Test sonrası verileri eski haline getir
sqliteService.connect(false);
sqliteService.run(`
    UPDATE product 
    SET gtin = NULL, sub_name2 = NULL, country_of_origin = NULL 
    WHERE id = 19822
`);
console.log('Test verileri eski haline getirildi: ID=19822');
sqliteService.disconnect();
