import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pg = require('pg');

const connectionString = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();

    console.log("Fetching 80k transaction...");

    const res = await client.query(`SELECT * FROM transactions WHERE amount = 80000 AND type = 'DEPOSIT_FROM_BANK'`);
    console.log("Transaction found:", res.rows);

    if (res.rows.length > 0) {
        const tx = res.rows[0];
        console.log(`To Wallet ID: ${tx.to_wallet_id}`);

        // Check if wallet exists
        const wRes = await client.query('SELECT * FROM wallets WHERE id = $1', [tx.to_wallet_id]);
        console.log("Wallet found:", wRes.rows);
    }

    await client.end();
}
run();
