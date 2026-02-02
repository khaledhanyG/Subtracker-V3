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

    const tx = await client.query('SELECT user_id, subscription_id, from_wallet_id, type FROM transactions WHERE subscription_id IS NOT NULL LIMIT 5');
    console.log("Transactions with Subscription Sample:", tx.rows);

    const sub = await client.query('SELECT id, name FROM subscriptions LIMIT 5');
    console.log("Subscriptions Sample:", sub.rows);

    const wal = await client.query('SELECT id, name FROM wallets LIMIT 5');
    console.log("Wallets Sample:", wal.rows);

    await client.end();
}
run();
