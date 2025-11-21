const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const excelPath = path.join(__dirname, '..', 'Web2ERP_Eslesme_Mapping_guncel_v9.xlsx');
const mdPath = path.join(__dirname, '..', 'Mapping_Reference.md');

const workbook = XLSX.readFile(excelPath);
let mdContent = '# Web2ERP Eşleşme Mapping Referansı\n\n';
mdContent += `Oluşturulma Tarihi: ${new Date().toLocaleString()}\n\n`;

workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length > 0) {
        mdContent += `## ${sheetName}\n\n`;

        // Get headers
        const headers = Object.keys(data[0]);
        mdContent += `| ${headers.join(' | ')} |\n`;
        mdContent += `| ${headers.map(() => '---').join(' | ')} |\n`;

        // Add rows
        data.forEach(row => {
            const rowData = headers.map(header => {
                let val = row[header];
                if (val === undefined || val === null) return '';
                return String(val).replace(/\n/g, ' '); // Remove newlines in cells
            });
            mdContent += `| ${rowData.join(' | ')} |\n`;
        });
        mdContent += '\n';
    }
});

fs.writeFileSync(mdPath, mdContent);
console.log(`Mapping_Reference.md created at ${mdPath}`);
