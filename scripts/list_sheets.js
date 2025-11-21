const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'Web2ERP_Eslesme_Mapping_guncel_v9.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);
