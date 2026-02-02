import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '..', 'transactions.xlsx');

console.log(`Reading file: ${filePath}`);

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    console.log(`Sheet Name: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length > 0) {
        console.log('Headers:', Object.keys(data[0]));
        console.log('First row:', data[0]);
        console.log('Total rows:', data.length);
    } else {
        console.log('Sheet is empty');
    }
} catch (error) {
    console.error('Error reading file:', error.message);
}
