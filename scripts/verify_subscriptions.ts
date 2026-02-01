import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const verify = async () => {
    const client = await pool.connect();
    try {
        console.log("Verifying Subscriptions...");
        const res = await client.query('SELECT id, name FROM subscriptions');
        const invalid = res.rows.filter(r => !r.id.startsWith('id_'));

        if (invalid.length > 0) {
            console.error("FAIL: Some subscriptions do not have semantic IDs:", invalid);
        } else {
            console.log(`PASS: All ${res.rows.length} subscriptions have semantic IDs.`);
        }

        console.log("Verifying Transactions Reference...");
        const txRes = await client.query('SELECT id, subscription_id FROM transactions WHERE subscription_id IS NOT NULL');
        const invalidTx = txRes.rows.filter(r => !r.subscription_id.startsWith('id_'));

        if (invalidTx.length > 0) {
            console.error("FAIL: Some transactions link to non-semantic subscription IDs:", invalidTx);
        } else {
            console.log(`PASS: All ${txRes.rows.length} linked transactions have semantic subscription IDs.`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
};

verify();
