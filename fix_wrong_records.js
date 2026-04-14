const mssqlService = require('./services/mssql.service');

async function fixWrongRecords() {
    try {
        const query = `
            UPDATE CARI_HESAP_HAREKETLERI 
            SET cha_grupno = 0 
            WHERE cha_evrak_tip = 63 
              AND cha_grupno = 1 
              AND cha_cari_cins IN (0, 4)
        `;
        
        const pool = await mssqlService.connect();
        const request = pool.request();
        const result = await request.query(query);
        
        console.log(`UPDATE_SUCCESS: Etkilenen (güncellenen) kayıt sayısı: ${result.rowsAffected[0]}`);
        process.exit(0);
    } catch (error) {
        console.error("ERROR:", error);
        process.exit(1);
    }
}

fixWrongRecords();
