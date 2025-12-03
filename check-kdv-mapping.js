require('dotenv').config();
const mssqlService = require('./services/mssql.service');

async function checkKdvMapping() {
    try {
        console.log('KDV Pointer Mapping kontrol ediliyor...\n');

        // Tablo var mı?
        const tableCheck = await mssqlService.query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'INT_KdvPointerMap'
        `);

        if (tableCheck.length === 0) {
            console.log('Tablo bulunamadi! Olusturuluyor...');

            await mssqlService.query(`
                CREATE TABLE INT_KdvPointerMap (
                    kdv_oran INT PRIMARY KEY,
                    vergi_pntr INT NOT NULL
                )
            `);

            console.log('Tablo olusturuldu. Veriler ekleniyor...');

            await mssqlService.query(`
                INSERT INTO INT_KdvPointerMap (kdv_oran, vergi_pntr) VALUES
                (0, 1),   -- %0 = YOK
                (1, 2),   -- %1 = VERGI %1
                (10, 3),  -- %10 = VERGI %10
                (20, 4),  -- %20 = VERGI %20
                (26, 5)   -- %26 = VERGI %26
            `);

            console.log('Veriler eklendi!');
        } else {
            console.log('Tablo mevcut. Icerigi:');
            const data = await mssqlService.query('SELECT * FROM INT_KdvPointerMap ORDER BY kdv_oran');
            console.table(data);
        }

    } catch (error) {
        console.error('Hata:', error.message);
    } finally {
        await mssqlService.disconnect();
    }
}

checkKdvMapping();
