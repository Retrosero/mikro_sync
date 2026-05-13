require('dotenv').config();
const pg = require('./services/postgresql.service');
const XLSX = require('xlsx');
const fs = require('fs');

async function generateExcelReport() {
    try {
        console.log('Excel raporu hazırlanıyor...');
        
        const allProducts = await pg.query('SELECT stok_kodu, stok_adi, eldeki_miktar FROM stoklar');
        const stockMap = new Map();
        allProducts.forEach(p => stockMap.set(p.stok_kodu, { stock: p.eldeki_miktar, name: p.stok_adi }));

        const data = [];

        for (const p of allProducts) {
            if (p.stok_kodu.includes('-')) {
                const parts = p.stok_kodu.split('-');
                const prefix = parts[0];
                
                if (stockMap.has(prefix)) {
                    const parent = stockMap.get(prefix);
                    if (parent.stock === 0 && p.eldeki_miktar > 0) {
                        data.push({
                            'Ana Stok Kodu': prefix,
                            'Ana Stok Adı': parent.name,
                            'Ana Stok Miktarı': parent.stock,
                            'Asorti Kodu': p.stok_kodu,
                            'Asorti Adı': p.stok_adi,
                            'Asorti Miktarı': p.eldeki_miktar
                        });
                    }
                }
            }
        }

        console.log(`${data.length} adet tutarsızlık bulundu.`);

        if (data.length > 0) {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Asorti Raporu');

            const fileName = 'ASORTI_STOK_TUTARSIZLIK_RAPORU.xlsx';
            XLSX.writeFile(workbook, fileName);
            console.log(`Excel dosyası oluşturuldu: ${fileName}`);
        } else {
            console.log('Hiç tutarsızlık bulunamadığı için Excel oluşturulmadı.');
        }

    } catch (e) {
        console.error('Excel oluşturma hatası:', e);
    } finally {
        await pg.disconnect();
    }
}

generateExcelReport();
