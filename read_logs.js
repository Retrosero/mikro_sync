const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'logs', 'error.log');

try {
    const data = fs.readFileSync(logPath, 'utf8');
    const lines = data.split('\n');
    const lastLines = lines.slice(-50); // Son 50 satır yeterli olmalı

    console.log('=== ERROR.LOG SONU ===');
    console.log(lastLines.join('\n'));
} catch (err) {
    console.error('Log okuma hatasi:', err);
}
