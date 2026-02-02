import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '..', 'transactions.xlsx');

function formatRawDate(val) {
    if (!val) return new Date().toISOString().slice(0, 10) + ' 00:00:00+00';

    // Check if string
    if (typeof val === 'string') {
        // Expected format: "2026-01-01 00:00:00+00" or similar
        // We want first 10 chars YYYY-MM-DD
        // Use regex to find YYYY-MM-DD
        const match = val.match(/(\d{4}-\d{2}-\d{2})/);
        if (match) {
            return match[1] + ' 00:00:00+00';
        }
    }

    // Check if number (Excel serial date)
    if (typeof val === 'number') {
        // Excel base date approx 1899-12-30
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        // Use UTC methods to avoid local shift
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d} 00:00:00+00`;
    }

    // Fallback: try JS date
    try {
        const d = new Date(val);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day} 00:00:00+00`;
    } catch (e) {
        return new Date().toISOString().slice(0, 10) + ' 00:00:00+00';
    }
}

async function run() {
    try {
        console.log(`Reading file: ${filePath}`);
        // IMPORTANT: cellDates false to get raw strings/numbers
        const workbook = XLSX.readFile(filePath, { cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const transactions = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (transactions.length === 0) {
            console.log("No transactions found.");
            return;
        }

        console.log(`Found ${transactions.length} transactions. Starting batch import...`);

        await client.connect();

        console.log("Deleting existing transactions...");
        await client.query('DELETE FROM transactions');
        console.log("Deleted all transactions.");

        const BATCH_SIZE = 100;
        let insertedCount = 0;

        for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
            const batch = transactions.slice(i, i + BATCH_SIZE);
            const values = [];
            const params = [];
            let paramIndex = 1;

            batch.forEach(tx => {
                const dateStr = formatRawDate(tx.date);
                const createdAtStr = formatRawDate(tx.created_at);

                values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`);
                params.push(
                    tx.user_id,
                    dateStr,
                    tx.amount,
                    tx.type,
                    tx.to_wallet_id,
                    tx.description || '',
                    createdAtStr
                );
                paramIndex += 7;
            });

            const query = `
        INSERT INTO transactions (user_id, date, amount, type, to_wallet_id, description, created_at)
        VALUES ${values.join(', ')}
      `;

            await client.query(query, params);
            insertedCount += batch.length;
            process.stdout.write('.');
        }

        console.log(`\nImport finished. Total inserted: ${insertedCount}`);
        await client.end();

    } catch (e) {
        console.error("Error:", e);
        try { await client.end(); } catch { }
    }
}

run();
