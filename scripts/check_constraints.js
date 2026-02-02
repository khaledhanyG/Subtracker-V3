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

    console.log("Checking wallet constraints...");

    // Query to get constraints on wallets table
    const query = `
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'wallets'::regclass;
  `;

    try {
        const res = await client.query(query);
        console.log("Constraints found:", res.rows);
    } catch (e) {
        console.error("Error checking constraints:", e);
    }

    await client.end();
}
run();
