import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        const countRes = await client.query('SELECT COUNT(*) FROM transactions');
        const count = parseInt(countRes.rows[0].count);
        console.log(`Total Transactions in DB: ${count}`);

        const sampleRes = await client.query('SELECT * FROM transactions LIMIT 1');
        if (sampleRes.rows.length > 0) {
            console.log("Sample Transaction:", sampleRes.rows[0]);
        } else {
            console.log("No transactions found.");
        }

        // Check against expected count (1678)
        if (count === 1678) {
            console.log("VERIFICATION PASSED: Count matches expected (1678).");
        } else {
            console.log(`VERIFICATION FAILED: Count mismatch. Expected 1678, got ${count}.`);
        }

        await client.end();
    } catch (e) {
        console.error("Error:", e);
        try { await client.end(); } catch { }
    }
}

run();
