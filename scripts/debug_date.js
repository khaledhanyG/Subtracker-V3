import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '..', 'transactions.xlsx');

console.log(`Reading file: ${filePath}`);
const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const transactions = XLSX.utils.sheet_to_json(worksheet);

if (transactions.length > 0) {
    const tx = transactions[0];
    console.log("Raw Date Object:", tx.date);
    if (tx.date instanceof Date) {
        console.log("toString:", tx.date.toString());
        console.log("toISOString:", tx.date.toISOString());
        console.log("UTC Date:", tx.date.getUTCDate());
        console.log("Local Date:", tx.date.getDate());
        console.log("UTC Hours:", tx.date.getUTCHours());
        console.log("Local Hours:", tx.date.getHours());

        // Check timezone offset
        console.log("Timezone Offset:", tx.date.getTimezoneOffset());
    } else {
        console.log("Date is not a Date object:", typeof tx.date);
    }
}
