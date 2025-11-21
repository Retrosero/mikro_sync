const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'Web2ERP_Eslesme_Mapping_guncel_v9.xlsx');
const workbook = XLSX.readFile(filePath);

function readSheet(sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
        console.log(`Sheet ${sheetName} not found`);
        return;
    }
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`--- ${sheetName} ---`);
    console.log(JSON.stringify(data.slice(0, 5), null, 2)); // Show first 5 rows to understand structure
}

readSheet('INT_CariHareketMap');
readSheet('INT_StokHareketMap');
