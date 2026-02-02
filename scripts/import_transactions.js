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
    ssl: {
        rejectUnauthorized: false
    }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, '..', 'transactions.xlsx');

async function run() {
    try {
        console.log(`Reading file: ${filePath}`);
        const workbook = XLSX.readFile(filePath, { cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const transactions = XLSX.utils.sheet_to_json(worksheet);

        if (transactions.length === 0) {
            console.log("No transactions found in Excel file.");
            return;
        }

        console.log(`Found ${transactions.length} transactions.`);

        await client.connect();
        console.log("Connected to DB.");

        console.log("Deleting existing transactions...");
        await client.query('DELETE FROM transactions');
        console.log("Deleted all transactions.");

        console.log("Inserting new transactions...");
        let successCount = 0;
        let errorCount = 0;

        for (const tx of transactions) {
            try {
                // Map fields
                // Excel headers: id, user_id, date, amount, type, to_wallet_id, description, created_at
                // Table columns: date, amount, type, to_wallet_id, description, id (optional), user_id, created_at, from_wallet_id

                // We will insert ignoring 'id' from existing schema if it's auto-generated UUID vs integer
                // BUT schema says id is UUID DEFAULT uuid_generate_v4()
                // Excel has integer IDs (1, 2...). 
                // If we insert integer into UUID column it will fail.
                // STRATEGY: Omit 'id' and let Postgres generate new UUIDs.
                // OR check if 'id' column in DB is actually text/integer?
                // Schema said UUID. Excel has 1.
                // Plan: Omit 'id' from insert.

                // Handle dates
                const date = tx.date ? new Date(tx.date) : new Date();
                const createdAt = tx.created_at ? new Date(tx.created_at) : new Date();

                await client.query(
                    `INSERT INTO transactions (
             user_id, date, amount, type, to_wallet_id, description, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        tx.user_id,
                        date,
                        tx.amount,
                        tx.type,
                        tx.to_wallet_id,
                        tx.description || '',
                        createdAt
                    ]
                );
                successCount++;
                if (successCount % 100 === 0) process.stdout.write('.');
            } catch (err) {
                console.error(`\nFailed to insert row ID ${tx.id}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\nImport finished.`);
        console.log(`Success: ${successCount}`);
        console.log(`Errors: ${errorCount}`);

        await client.end();
    } catch (e) {
        console.error("Fatal Error:", e);
        try { await client.end(); } catch { }
    }
}

run();
