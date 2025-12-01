require('dotenv').config();
const pgService = require('../services/postgresql.service');

console.error('✗ Hata:', error.message);
throw error;
    } finally {
    await pgService.disconnect();
}
}

cleanTriggers();
