import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();

        // Select a sample transaction. We know ID 1584 exists from previous run, or just take random.
        // Also selected date to see format.
        const res = await client.query("SELECT id, date, created_at, type FROM transactions LIMIT 5");

        console.log("Sample Transactions:");
        res.rows.forEach(row => {
            console.log(`ID: ${row.id}, Date: ${row.date}, Type: ${row.type}`);
            // Check if date looks like '2026-01-01T00:00:00.000Z' or similar
        });

        await client.end();
    } catch (e) {
        console.error(e);
        try { await client.end(); } catch { }
    }
}

run();
