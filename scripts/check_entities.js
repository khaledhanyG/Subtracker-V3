import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://neondb_owner:npg_mMLSva9YQ5Eu@ep-blue-leaf-ahtstx2d-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Neon often needs this or valid CA
    }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        const users = await client.query('SELECT id, name, email FROM users');
        console.log("Users:", users.rows);

        const wallets = await client.query('SELECT id, name, type FROM wallets');
        console.log("Wallets:", wallets.rows);

        await client.end();
    } catch (e) {
        console.error("Error:", e);
        try { await client.end(); } catch { }
    }
}

run();
