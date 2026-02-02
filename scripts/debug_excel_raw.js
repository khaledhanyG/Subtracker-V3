import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '..', 'transactions.xlsx');

console.log(`Reading file: ${filePath}`);
// Read WITHOUT cellDates to get raw serial numbers or strings
const workbook = XLSX.readFile(filePath, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get range
const range = XLSX.utils.decode_range(worksheet['!ref']);
console.log("Range:", range);

// Inspect first few rows manually
for (let R = range.s.r; R <= Math.min(range.e.r, 5); ++R) {
    const row = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        const cell = worksheet[cell_ref];
        if (cell) {
            row.push({
                val: cell.v, // raw value
                w: cell.w,   // formatted text
                t: cell.t    // type (n=number, s=string)
            });
        }
    }
    console.log(`Row ${R}:`, JSON.stringify(row, null, 2));
}
