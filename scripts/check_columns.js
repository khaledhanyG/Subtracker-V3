import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pg = require('pg');

const connectionString = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB");

        console.log("--- Transactions ---");
        const tx = await client.query('SELECT * FROM transactions LIMIT 1');
        if (tx.rows.length > 0) {
            console.log(Object.keys(tx.rows[0]));
        } else {
            console.log("No transactions found");
        }

        console.log("\n--- Wallets ---");
        const w = await client.query('SELECT * FROM wallets LIMIT 1');
        if (w.rows.length > 0) {
            console.log(Object.keys(w.rows[0]));
        } else {
            console.log("No wallets found");
        }

        console.log("\n--- Subscriptions ---");
        const sub = await client.query('SELECT * FROM subscriptions LIMIT 1');
        if (sub.rows.length > 0) {
            console.log(Object.keys(sub.rows[0]));
        } else {
            console.log("No subscriptions found");
        }

        await client.end();
    } catch (e) {
        console.error(e);
    }
}

run();
